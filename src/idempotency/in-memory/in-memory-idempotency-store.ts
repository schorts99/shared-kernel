import { IdempotencyStore } from "../idempotency-store";

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Map<string, { result: unknown; expiresAt?: number }>();

  async isProcessed(key: string): Promise<boolean> {
    const entry = this.processed.get(key);

    if (!entry) return false;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.processed.delete(key);

      return false;
    }

    return true;
  }

  async markProcessed(key: string, result: unknown, ttl?: number): Promise<void> {
    if (ttl) {
      this.processed.set(key, { result, expiresAt: Date.now() + ttl });
    } else {
      this.processed.set(key, { result });
    }
  }

  async clear(key: string): Promise<boolean> {
    return this.processed.delete(key);
  }

  async getResult(key: string): Promise<unknown | undefined> {
    const entry = this.processed.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.processed.delete(key);

      return undefined;
    }

    return entry.result;
  }
}
