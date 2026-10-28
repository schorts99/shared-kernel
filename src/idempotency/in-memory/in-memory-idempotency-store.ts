import { IdempotencyStore } from "../idempotency-store";
import { getExpirationTime } from "../../utils/expiration";

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Map<string, { result: unknown; expiresAt?: number }>();

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
    const expiresAt = getExpirationTime(ttl);

    if (ttl === 0) {
      this.processed.delete(key);
    } else if (expiresAt !== undefined) {
      this.processed.set(key, { result, expiresAt });
    } else {
      this.processed.set(key, { result });
    }
  }

  async clear(key: string): Promise<boolean> {
    return this.processed.delete(key);
  }

  async clearStore(): Promise<void> {
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
