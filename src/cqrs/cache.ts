export interface Cache<T = unknown> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface IdempotencyStore {
  isProcessed(key: string): Promise<boolean>;
  markProcessed(key: string, result: unknown, ttl?: number): Promise<void>;
  clear(key: string): Promise<boolean>;
}
