import { OfflinePayload } from "../offline-payload.js";
import { OfflineStore } from "../offline-store.js";
import { cloneValue } from "../../utils/object.js";

export interface InMemoryOfflineStoreOptions {
  /** Maximum number of queued offline entries before rejecting new enqueues (default 10,000). */
  maxEntries?: number;
}

export class InMemoryOfflineStore<T = OfflinePayload> implements OfflineStore<T> {
  private readonly entries = new Map<string, T>();
  private readonly maxEntries: number;

  constructor(options: InMemoryOfflineStoreOptions = {}) {
    const max = options.maxEntries ?? 10_000;
    if (!Number.isSafeInteger(max) || max < 1) {
      throw new RangeError("maxEntries must be a positive safe integer");
    }
    this.maxEntries = max;
  }

  async enqueue(key: string, payload: T): Promise<void> {
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      throw new Error("Offline store capacity exceeded");
    }
    this.entries.set(key, cloneValue(payload));
  }

  async list(): Promise<Array<{ key: string; payload: T }>> {
    return Array.from(this.entries.entries()).map(([key, payload]) => ({
      key,
      payload: cloneValue(payload),
    }));
  }

  async dequeue(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }
}
