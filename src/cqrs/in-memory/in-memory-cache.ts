import { Cache } from "../cache";

export class InMemoryCache<T = unknown> implements Cache<T> {
  private readonly cache = new Map<string, { value: T; expiresAt?: number; tags?: string[] }>();
  private readonly tagMap = new Map<string, Set<string>>();

  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);

      return undefined;
    }

    return entry.value;
  }

  async set(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    const expiresAt = ttl ? Date.now() + ttl : undefined;
    const oldEntry = this.cache.get(key);

    if (oldEntry?.tags) {
      for (const tag of oldEntry.tags) {
        this.tagMap.get(tag)?.delete(key);
      }
    }

    const newEntry: { value: T; expiresAt?: number; tags?: string[] } = { value };

    if (expiresAt !== undefined) {
      newEntry.expiresAt = expiresAt;
    }

    if (tags !== undefined) {
      newEntry.tags = tags;
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

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);

      return false;
    }

    return true;
  }
}