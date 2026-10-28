import { IdempotencyStore } from "../idempotency-store";
import { getExpirationTime } from "../../utils/expiration";
import type { IdempotencyExecution } from "../idempotency-executor";
import { CommitOutcomeUnknownError } from "../../unit-of-work/commit-outcome-unknown-error";

export interface InMemoryIdempotencyStoreOptions {
  /** Bounds completed and in-progress keys (default 10,000); new keys reject at capacity. */
  maxEntries?: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Map<string, {
    result: unknown;
    expiresAt?: number;
    completion?: { run: () => Promise<void>; ttl: number | undefined };
    unknownCommit?: CommitOutcomeUnknownError;
  }>();
  private readonly inProgress = new Map<string, Promise<unknown>>();

  constructor(private readonly options: InMemoryIdempotencyStoreOptions = {}) {
    if (options.maxEntries !== undefined && (!Number.isSafeInteger(options.maxEntries) || options.maxEntries < 1)) {
      throw new RangeError("maxEntries must be a positive safe integer");
    }
    this.options = { maxEntries: options.maxEntries ?? 10_000 };
  }

  async execute<T>(key: string, operation: () => Promise<T>, ttl?: number): Promise<T> {
    return this.executeWithCompletion(key, async () => ({ result: await operation() }), ttl);
  }

  async executeWithCompletion<T>(
    key: string,
    operation: () => Promise<IdempotencyExecution<T>>,
    ttl?: number,
  ): Promise<T> {
    getExpirationTime(ttl);
    this.pruneExpired();
    const ongoing = this.inProgress.get(key);

    if (ongoing) return ongoing as Promise<T>;
    const stored = this.processed.get(key);
    if (stored?.unknownCommit) throw stored.unknownCommit;
    if (stored && !stored.completion) return stored.result as T;

    this.checkCapacity(key);

    const execution = Promise.resolve().then(async () => {
      const outcome = stored ? undefined : await operation();
      const record = stored ?? outcome!;
      const completion = stored?.completion ?? (outcome?.complete ? { run: outcome.complete, ttl } : undefined);
      if (completion) {
        this.processed.set(key, { result: record.result, completion });
        await completion.run();
      }
      const result = record.result as T;
      this.storeResult(key, result, completion ? completion.ttl : ttl);
      return result;
    }).catch(error => {
      if (error instanceof CommitOutcomeUnknownError) {
        this.processed.set(key, { result: undefined, unknownCommit: error });
      }
      throw error;
    }).finally(() => {
      this.inProgress.delete(key);
    });

    this.inProgress.set(key, execution);
    return execution;
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
    | { status: "committed"; execution: IdempotencyExecution<unknown> }): Promise<void> {
    if (this.inProgress.has(key)) throw new Error("Cannot reconcile an in-progress key");
    if (!this.processed.get(key)?.unknownCommit) throw new Error("Key has no unknown commit outcome");
    if (outcome.status === "not-committed") {
      this.processed.delete(key);
    } else {
      this.processed.set(key, {
        result: outcome.execution.result,
        ...(outcome.execution.complete ? { completion: { run: outcome.execution.complete, ttl: undefined } } : {}),
      });
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

  private storeResult(key: string, result: unknown, ttl?: number): void {
    const expiresAt = getExpirationTime(ttl);
    this.pruneExpired();
    if (ttl !== 0) this.checkCapacity(key);

    if (ttl === 0) {
      this.processed.delete(key);
    } else if (expiresAt !== undefined) {
      this.processed.set(key, { result, expiresAt });
    } else {
      this.processed.set(key, { result });
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

    return entry.result;
  }
}
