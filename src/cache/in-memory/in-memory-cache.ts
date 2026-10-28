import { Cache } from "../../cache";
import { getExpirationTime } from "../../utils/expiration";
import { cloneValue as defaultCloneValue } from "../../utils/object";

export interface InMemoryCacheOptions<T = unknown> {
  /** Maximum retained entries; defaults to 10,000. Evicts the oldest entry when full. */
  maxEntries?: number;
  /** Defaults to domain-aware deep cloning; supply a custom copier to override. */
  cloneValue?: (value: T) => T;
}

export class InMemoryCache<T = unknown> implements Cache<T> {
  private readonly cache = new Map<string, { value: T; expiresAt?: number; tags?: string[] }>();
  private readonly tagMap = new Map<string, Set<string>>();

  constructor(private readonly options: InMemoryCacheOptions<T> = {}) {
    if (options.maxEntries !== undefined && (!Number.isSafeInteger(options.maxEntries) || options.maxEntries < 1)) {
      throw new RangeError("maxEntries must be a positive safe integer");
    }
    this.options = { maxEntries: options.maxEntries ?? 10_000,
      ...(options.cloneValue ? { cloneValue: options.cloneValue } : {}) };
  }

  private clone(value: T): T {
    return this.options.cloneValue ? this.options.cloneValue(value) : defaultCloneValue(value);
  }

  async prune(): Promise<number> {
    return this.pruneExpired();
  }

  private pruneExpired(): number {
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
        this.deleteEntry(key);
        removed++;
      }
    }
    return removed;
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.deleteEntry(key);

      return undefined;
    }

    return this.clone(entry.value);
  }

  async set(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    const expiresAt = getExpirationTime(ttl);
    const storedValue = this.clone(value);
    this.pruneExpired();

    this.deleteEntry(key);

    if (ttl === 0) return;

    if (this.options.maxEntries !== undefined && this.cache.size >= this.options.maxEntries) {
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.deleteEntry(oldest.value);
    }

    const newEntry: { value: T; expiresAt?: number; tags?: string[] } = { value: storedValue };

    if (expiresAt !== undefined) {
      newEntry.expiresAt = expiresAt;
    }

    if (tags !== undefined) {
      newEntry.tags = [...tags];
    }

    this.cache.set(key, newEntry);

    if (tags) {
      for (const tag of tags) {
        if (!this.tagMap.has(tag)) {
          this.tagMap.set(tag, new Set());
        }

        this.tagMap.get(tag)!.add(key);
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.deleteEntry(key);
  }

  private deleteEntry(key: string): boolean {
    const entry = this.cache.get(key);

    if (entry?.tags) {
      for (const tag of entry.tags) {
        this.tagMap.get(tag)?.delete(key);

        if (this.tagMap.get(tag)?.size === 0) {
          this.tagMap.delete(tag);
        }
      }
    }
    return this.cache.delete(key);
  }

  async deleteByTag(tag: string): Promise<void> {
    const keys = this.tagMap.get(tag);
    if (keys) {
      for (const key of Array.from(keys)) {
        await this.delete(key);
      }
    }
  }

  async deleteByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.deleteByTag(tag);
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.tagMap.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) return false;

    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      await this.delete(key);

      return false;
    }

    return true;
  }
}
