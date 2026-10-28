export interface IdempotencyExecutor {
  /**
   * Joins in-progress work for the same key and reuses successful results.
   * Failures are not cached. TTL starts on success; callers sharing a key must use the same result type.
   * Atomicity is scoped to the executor implementation (one shared instance for the in-memory store).
   */
  execute<T>(key: string, operation: () => Promise<T>, ttl?: number): Promise<T>;
}
