import type { UnitOfWork } from "../../unit-of-work/unit-of-work";
import { CommitOutcomeUnknownError } from "../../unit-of-work/commit-outcome-unknown-error";
import type {
  CommittedIdempotencyRecord,
  CommitResolution,
  TransactionalIdempotencyAdapter,
} from "../transactional-idempotency-adapter";
import { cloneValue as defaultCloneValue } from "../../utils/object";
import {
  addWaitEdge,
  assertNoCycleWhenWaitingOn,
  getCurrentExecutionNode,
  getInFlightTaskOwner,
  registerInFlightTask,
  removeWaitEdge,
} from "../../cqrs/bus-runtime";

export interface InMemoryTransactionalIdempotencyOptions {
  cloneValue?: (value: unknown) => unknown;
}

interface ActiveClaim {
  readonly unitOfWork: UnitOfWork;
  readonly promise: Promise<void>;
  readonly release: () => void;
}

export class InMemoryTransactionalIdempotencyAdapter implements TransactionalIdempotencyAdapter {
  private readonly committed = new Map<string, CommittedIdempotencyRecord>();
  private readonly stagedByUow = new WeakMap<UnitOfWork, Map<string, CommittedIdempotencyRecord>>();
  private readonly claimsByUow = new WeakMap<UnitOfWork, Set<string>>();
  private readonly instrumentedUows = new WeakSet<UnitOfWork>();
  private readonly activeClaims = new Map<string, ActiveClaim>();
  private readonly ambiguousRecords = new Map<string, CommittedIdempotencyRecord | undefined>();
  private readonly cloneFn: (value: unknown) => unknown;

  constructor(options: InMemoryTransactionalIdempotencyOptions = {}) {
    this.cloneFn = options.cloneValue ?? defaultCloneValue;
  }

  private cloneRecord(record: CommittedIdempotencyRecord): CommittedIdempotencyRecord {
    return {
      result: this.cloneFn(record.result),
      events: defaultCloneValue(record.events),
    };
  }

  private instrumentUnitOfWork(unitOfWork: UnitOfWork): void {
    if (this.instrumentedUows.has(unitOfWork)) return;
    this.instrumentedUows.add(unitOfWork);

    const originalCommit = unitOfWork.commit.bind(unitOfWork);
    const originalRollback = unitOfWork.rollback.bind(unitOfWork);

    unitOfWork.commit = async () => {
      try {
        await originalCommit();
        const staged = this.stagedByUow.get(unitOfWork);
        if (staged) {
          for (const [key, record] of staged.entries()) {
            if (!this.ambiguousRecords.has(key)) {
              this.committed.set(key, this.cloneRecord(record));
            }
          }
          staged.clear();
        }
      } catch (error) {
        const staged = this.stagedByUow.get(unitOfWork);
        if (error instanceof CommitOutcomeUnknownError && staged) {
          for (const [key, record] of staged.entries()) {
            this.ambiguousRecords.set(key, this.cloneRecord(record));
          }
        }
        throw error;
      } finally {
        this.releaseClaims(unitOfWork);
      }
    };

    unitOfWork.rollback = async () => {
      try {
        await originalRollback();
      } finally {
        this.stagedByUow.delete(unitOfWork);
        this.releaseClaims(unitOfWork);
      }
    };
  }

  private releaseClaims(unitOfWork: UnitOfWork): void {
    const keys = this.claimsByUow.get(unitOfWork);
    if (!keys) return;
    for (const key of keys) {
      const claim = this.activeClaims.get(key);
      if (claim?.unitOfWork === unitOfWork) {
        this.activeClaims.delete(key);
        claim.release();
      }
    }
    keys.clear();
  }

  async claim(unitOfWork: UnitOfWork, key: string): Promise<CommittedIdempotencyRecord | undefined> {
    for (;;) {
      if (this.ambiguousRecords.has(key)) {
        throw new CommitOutcomeUnknownError(new Error(`Commit outcome for key '${key}' is unknown`), key);
      }

      const existingCommitted = this.committed.get(key);
      if (existingCommitted) {
        return this.cloneRecord(existingCommitted);
      }

      const active = this.activeClaims.get(key);
      if (!active || active.unitOfWork === unitOfWork) {
        break;
      }

      const currentNode = getCurrentExecutionNode();
      const ownerNode = getInFlightTaskOwner(active.promise);
      if (currentNode && ownerNode) {
        assertNoCycleWhenWaitingOn(currentNode, ownerNode);
        addWaitEdge(currentNode, ownerNode);
      }
      try {
        await active.promise;
      } finally {
        if (currentNode && ownerNode) {
          removeWaitEdge(currentNode, ownerNode);
        }
      }
    }

    this.instrumentUnitOfWork(unitOfWork);
    if (!this.activeClaims.has(key)) {
      let releaseFn!: () => void;
      const promise = new Promise<void>(resolve => {
        releaseFn = resolve;
      });
      registerInFlightTask(promise, getCurrentExecutionNode());
      this.activeClaims.set(key, {
        unitOfWork,
        promise,
        release: releaseFn,
      });
      let uowClaims = this.claimsByUow.get(unitOfWork);
      if (!uowClaims) {
        uowClaims = new Set();
        this.claimsByUow.set(unitOfWork, uowClaims);
      }
      uowClaims.add(key);
    }

    return undefined;
  }

  async record(unitOfWork: UnitOfWork, key: string, record: CommittedIdempotencyRecord): Promise<void> {
    this.instrumentUnitOfWork(unitOfWork);
    let staged = this.stagedByUow.get(unitOfWork);
    if (!staged) {
      staged = new Map();
      this.stagedByUow.set(unitOfWork, staged);
    }
    staged.set(key, this.cloneRecord(record));
  }

  async resolve(key: string): Promise<CommitResolution> {
    if (this.ambiguousRecords.has(key)) {
      return { status: "unknown" };
    }
    const committed = this.committed.get(key);
    if (committed) {
      return {
        status: "committed",
        record: this.cloneRecord(committed),
      };
    }
    return { status: "not-committed" };
  }

  /** Marks a key as having an ambiguous commit outcome until explicitly reconciled. */
  markAmbiguous(key: string, stagedRecord?: CommittedIdempotencyRecord): void {
    this.ambiguousRecords.set(key, stagedRecord ? this.cloneRecord(stagedRecord) : this.committed.get(key));
    this.committed.delete(key);
  }

  /** Reconciles a previously ambiguous commit outcome as either committed or not-committed. */
  reconcile(
    key: string,
    outcome:
      | { status: "not-committed" }
      | { status: "committed"; record?: CommittedIdempotencyRecord | undefined },
  ): void {
    if (!this.ambiguousRecords.has(key)) {
      throw new Error(`Key '${key}' has no ambiguous commit outcome to reconcile`);
    }
    const staged = this.ambiguousRecords.get(key);
    this.ambiguousRecords.delete(key);
    if (outcome.status === "committed") {
      const record = outcome.record ?? staged;
      if (!record) {
        throw new Error(`Reconciling key '${key}' as committed requires a record when none was staged`);
      }
      this.committed.set(key, this.cloneRecord(record));
    } else {
      this.committed.delete(key);
    }
  }
}
