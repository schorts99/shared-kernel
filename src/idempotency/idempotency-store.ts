export interface IdempotencyStore {
  isProcessed(key: string): Promise<boolean>;
  markProcessed(key: string, result: unknown, ttl?: number): Promise<void>;
  clear(key: string): Promise<boolean>;
  getResult(key: string): Promise<unknown | undefined>;
}
