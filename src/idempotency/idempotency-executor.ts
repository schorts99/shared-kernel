export interface IdempotencyExecution<T> {
  result: T;
  /** Runs after the result is retained; failure retries completion, never the committed operation. */
  complete?: () => Promise<void>;
}

export interface IdempotencyExecutor {
  /**
   * Joins in-progress work for the same key and reuses successful results.
   * Operation failures are not cached; pending committed completion resumes on retry.
   * TTL starts on success; callers sharing a key must use the same result type.
   * Atomicity is scoped to the executor implementation (one shared instance for the in-memory store).
   */
  execute<T>(key: string, operation: () => Promise<T>, ttl?: number): Promise<T>;
  /**
   * operation must return only after commit. Pending completion must not expire or be evicted.
   * TTL starts after completion succeeds. The in-memory implementation is not crash-durable.
   */
  executeWithCompletion<T>(key: string, operation: () => Promise<IdempotencyExecution<T>>, ttl?: number): Promise<T>;
}
