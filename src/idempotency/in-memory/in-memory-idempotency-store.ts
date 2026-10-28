import { IdempotencyStore } from "../idempotency-store";
import { getExpirationTime } from "../../utils/expiration";

export interface InMemoryIdempotencyStoreOptions {
  /** Bounds completed and in-progress keys (default 10,000); new keys reject at capacity. */
  maxEntries?: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Map<string, { result: unknown; expiresAt?: number }>();
  private readonly inProgress = new Map<string, Promise<unknown>>();

  constructor(private readonly options: InMemoryIdempotencyStoreOptions = {}) {
    if (options.maxEntries !== undefined && (!Number.isSafeInteger(options.maxEntries) || options.maxEntries < 1)) {
      throw new RangeError("maxEntries must be a positive safe integer");
    }
    this.options = { maxEntries: options.maxEntries ?? 10_000 };
  }

  async execute<T>(key: string, operation: () => Promise<T>, ttl?: number): Promise<T> {
    getExpirationTime(ttl);
    this.pruneExpired();
    const ongoing = this.inProgress.get(key);

    if (ongoing) return ongoing as Promise<T>;
    if (this.processed.has(key)) return Promise.resolve(this.processed.get(key)!.result as T);

    this.checkCapacity(key);

    const execution = Promise.resolve().then(operation).then(async result => {
      this.storeResult(key, result, ttl);
      return result;
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

  async isProcessed(key: string): Promise<boolean> {
    const entry = this.processed.get(key);

    if (!entry) return false;

    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.processed.delete(key);

      return false;
    }

    return true;
  }

  async markProcessed(key: string, result: unknown, ttl?: number): Promise<void> {
    if (this.inProgress.has(key)) throw new Error("Cannot replace an in-progress idempotency key");
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
    if (this.inProgress.has(key)) throw new Error("Cannot clear an in-progress idempotency key");
    return this.processed.delete(key);
  }

  async clearStore(): Promise<void> {
    if (this.inProgress.size > 0) throw new Error("Cannot clear idempotency store while operations are in progress");
    this.processed.clear();
  }

  async getResult(key: string): Promise<unknown | undefined> {
    const entry = this.processed.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.processed.delete(key);

      return undefined;
    }

    return entry.result;
  }
}
