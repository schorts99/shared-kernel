import { IdempotencyStore } from "../idempotency-store.js";
import { getExpirationTime } from "../../utils/expiration.js";
import { cloneValue as defaultCloneValue } from "../../utils/object.js";
import type { IdempotencyExecution, UnknownCommitReconciliation } from "../idempotency-executor.js";
import { CommitOutcomeUnknownError } from "../../unit-of-work/commit-outcome-unknown-error.js";
import {
  addWaitEdge,
  assertNoCycleWhenWaitingOn,
  getCurrentExecutionNode,
  getInFlightTaskOwner,
  getSharedExecutionStorage,
  registerInFlightTask,
  removeWaitEdge,
} from "../../cqrs/bus-runtime.js";
import type { ExecutionContext, ExecutionContextStorage } from "../../types/execution-context.js";
import type { ExecutionNode } from "../../cqrs/bus-runtime.js";

export interface InMemoryIdempotencyStoreOptions {
  /** Bounds completed and in-progress keys (default 10,000); new keys reject at capacity. */
  maxEntries?: number;
  /** Optional custom copier for isolating stored results on write and read. */
  cloneValue?: (value: unknown) => unknown;
  /** Optional execution context for dependency-graph cycle detection across shared in-flight keys. */
  executionContext?: ExecutionContext;
}

interface ProcessedIdempotencyEntry {
  result: unknown;
  expiresAt?: number;
  ttl?: number | undefined;
  completion?: { run: () => Promise<void>; ttl: number | undefined };
  unknownCommit?: CommitOutcomeUnknownError;
  stagedExecution?: IdempotencyExecution<unknown>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Map<string, ProcessedIdempotencyEntry>();
  private readonly inProgress = new Map<string, Promise<unknown>>();
  private readonly executionStorage: ExecutionContextStorage<ExecutionNode> | undefined;

  constructor(private readonly options: InMemoryIdempotencyStoreOptions = {}) {
    if (options.maxEntries !== undefined && (!Number.isSafeInteger(options.maxEntries) || options.maxEntries < 1)) {
      throw new RangeError("maxEntries must be a positive safe integer");
    }
    this.executionStorage = getSharedExecutionStorage(options.executionContext);
    this.options = {
      maxEntries: options.maxEntries ?? 10_000,
      ...(options.cloneValue ? { cloneValue: options.cloneValue } : {}),
      ...(options.executionContext ? { executionContext: options.executionContext } : {}),
    };
  }

  private clone<T>(value: T): T {
    return (this.options.cloneValue ? this.options.cloneValue(value) : defaultCloneValue(value)) as T;
  }

  async execute<T>(key: string, operation: () => Promise<T>, ttl?: number): Promise<T> {
    return this.executeWithCompletion(key, async () => ({ result: await operation() }), ttl);
  }

  async executeWithCompletion<T>(
    key: string,
    operation: () => Promise<IdempotencyExecution<T>>,
    ttl?: number,
    reconcile?: (error: CommitOutcomeUnknownError) => Promise<UnknownCommitReconciliation<T>>,
  ): Promise<T> {
    getExpirationTime(ttl);
    this.pruneExpired();
    const ongoing = this.inProgress.get(key);

    if (ongoing) {
      const currentNode = getCurrentExecutionNode(this.executionStorage);
      const ownerNode = getInFlightTaskOwner(ongoing);
      if (currentNode && ownerNode) {
        assertNoCycleWhenWaitingOn(
          currentNode,
          ownerNode,
          ownerNode === currentNode ? `Recursive command dispatch for idempotency key '${key}'` : undefined,
        );
        addWaitEdge(currentNode, ownerNode);
      }
      try {
        const joinedResult = await ongoing;
        return this.clone(joinedResult as T);
      } finally {
        if (currentNode && ownerNode) {
          removeWaitEdge(currentNode, ownerNode);
        }
      }
    }

    const stored = this.processed.get(key);
    if (stored?.unknownCommit && !reconcile) {
      throw stored.unknownCommit;
    }
    if (stored && !stored.completion && !stored.unknownCommit) {
      return this.clone(stored.result as T);
    }

    this.checkCapacity(key);
    const ownerNode = getCurrentExecutionNode(this.executionStorage);

    const execution = Promise.resolve().then(async () => {
      let activeStored = stored;
      if (activeStored?.unknownCommit) {
        let resolution: UnknownCommitReconciliation<T>;
        try {
          resolution = await reconcile!(activeStored.unknownCommit);
        } catch (reconcileError) {
          const combined = new CommitOutcomeUnknownError(
            new AggregateError([activeStored.unknownCommit.cause ?? activeStored.unknownCommit, reconcileError]),
            key,
            activeStored.stagedExecution,
          );
          this.processed.set(key, {
            ...activeStored,
            unknownCommit: combined,
          });
          throw combined;
        }
        if (resolution.status === "unknown") {
          throw activeStored.unknownCommit;
        }
        if (resolution.status === "not-committed") {
          this.processed.delete(key);
          activeStored = undefined;
        } else {
          const recoveredExecution = resolution.execution
            ?? (activeStored.stagedExecution as IdempotencyExecution<T> | undefined)
            ?? { result: activeStored.result as T };
          const clonedRecoveredResult = this.clone(recoveredExecution.result);
          const effectiveTtl = activeStored.ttl ?? ttl;
          activeStored = {
            result: clonedRecoveredResult,
            ...(recoveredExecution.complete
              ? { completion: { run: recoveredExecution.complete, ttl: effectiveTtl } }
              : {}),
          };
          this.processed.set(key, activeStored);
        }
      }

      const outcome = activeStored ? undefined : await operation();
      const rawResult = activeStored ? (activeStored.result as T) : outcome!.result;
      const clonedResult = activeStored ? (activeStored.result as T) : this.clone(rawResult);
      const completion = activeStored?.completion ?? (outcome?.complete ? { run: outcome.complete, ttl } : undefined);
      if (completion) {
        this.processed.set(key, { result: clonedResult, completion });
        await completion.run();
      }
      this.storeResult(key, clonedResult, completion ? completion.ttl : ttl, true);
      return clonedResult;
    }).catch(error => {
      if (error instanceof CommitOutcomeUnknownError) {
        const existing = this.processed.get(key);
        const staged = error.stagedExecution ?? existing?.stagedExecution;
        const clonedStaged = staged
          ? {
            result: this.clone(staged.result),
            ...(staged.complete ? { complete: staged.complete } : {}),
          }
          : undefined;
        this.processed.set(key, {
          result: clonedStaged?.result,
          unknownCommit: error,
          ...(clonedStaged ? { stagedExecution: clonedStaged } : {}),
          ...(ttl !== undefined ? { ttl } : (existing?.ttl !== undefined ? { ttl: existing.ttl } : {})),
        });
      }
      throw error;
    }).finally(() => {
      this.inProgress.delete(key);
    });

    registerInFlightTask(execution, ownerNode);
    this.inProgress.set(key, execution);
    const finalResult = await execution;
    return this.clone(finalResult);
  }

  private checkCapacity(key: string): void {
    const keys = new Set([...this.processed.keys(), ...this.inProgress.keys()]);
    if (!keys.has(key) && this.options.maxEntries !== undefined && keys.size >= this.options.maxEntries) {
      throw new Error("Idempotency store capacity exceeded");
    }
  }

  private pruneExpired(): number {
    let removed = 0;
    for (const [key, entry] of this.processed) {
      if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
        this.processed.delete(key);
        removed++;
      }
    }
    return removed;
  }

  async prune(): Promise<number> {
    return this.pruneExpired();
  }

  async resolveUnknownCommit(key: string, outcome:
    | { status: "not-committed" }
    | { status: "committed"; execution?: IdempotencyExecution<unknown> | undefined }): Promise<void> {
    if (this.inProgress.has(key)) throw new Error("Cannot reconcile an in-progress key");
    const entry = this.processed.get(key);
    if (!entry?.unknownCommit) throw new Error("Key has no unknown commit outcome");
    if (outcome.status === "not-committed") {
      this.processed.delete(key);
    } else {
      const effectiveExecution = outcome.execution ?? entry.stagedExecution;
      if (!effectiveExecution) {
        throw new Error("Committed reconciliation requires an execution record when none was staged");
      }
      const clonedResult = this.clone(effectiveExecution.result);
      const completeFn = effectiveExecution.complete ?? entry.stagedExecution?.complete;
      if (completeFn) {
        this.processed.set(key, {
          result: clonedResult,
          completion: { run: completeFn, ttl: entry.ttl },
        });
      } else {
        this.storeResult(key, clonedResult, entry.ttl, true);
      }
    }
  }

  async isProcessed(key: string): Promise<boolean> {
    const entry = this.processed.get(key);

    if (!entry || entry.completion || entry.unknownCommit) return false;

    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.processed.delete(key);

      return false;
    }

    return true;
  }

  async markProcessed(key: string, result: unknown, ttl?: number): Promise<void> {
    if (this.inProgress.has(key) || this.processed.get(key)?.completion || this.processed.get(key)?.unknownCommit) {
      throw new Error("Cannot replace an in-progress or pending-completion idempotency key");
    }
    this.storeResult(key, result, ttl);
  }

  private storeResult(key: string, result: unknown, ttl?: number, alreadyCloned = false): void {
    const expiresAt = getExpirationTime(ttl);
    const storedResult = alreadyCloned ? result : this.clone(result);
    this.pruneExpired();
    if (ttl !== 0) this.checkCapacity(key);

    if (ttl === 0) {
      this.processed.delete(key);
    } else if (expiresAt !== undefined) {
      this.processed.set(key, { result: storedResult, expiresAt });
    } else {
      this.processed.set(key, { result: storedResult });
    }
  }

  async clear(key: string): Promise<boolean> {
    if (this.inProgress.has(key) || this.processed.get(key)?.completion || this.processed.get(key)?.unknownCommit) {
      throw new Error("Cannot clear an in-progress or pending-completion idempotency key");
    }
    return this.processed.delete(key);
  }

  async clearStore(): Promise<void> {
    if (this.inProgress.size > 0) throw new Error("Cannot clear idempotency store while operations are in progress");
    if ([...this.processed.values()].some(entry => entry.completion || entry.unknownCommit)) {
      throw new Error("Cannot clear idempotency store while committed completion is pending");
    }
    this.processed.clear();
  }

  async getResult(key: string): Promise<unknown | undefined> {
    const entry = this.processed.get(key);

    if (!entry || entry.completion || entry.unknownCommit) return undefined;

    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.processed.delete(key);

      return undefined;
    }

    return this.clone(entry.result);
  }
}
