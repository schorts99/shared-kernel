import { Cache } from "../cache";

export class InMemoryCache<T = unknown> implements Cache<T> {
  private readonly cache = new Map<string, { value: T; expiresAt?: number }>();

  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);

      return undefined;
    }

    return entry.value;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    if (ttl) {
      this.cache.set(key, { value, expiresAt: Date.now() + ttl });
    } else {
      this.cache.set(key, { value });
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) return false;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);

      return false;
    }

    return true;
  }
}