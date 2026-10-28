import type { IdempotencyExecutor, IdempotencyExecution } from "./idempotency-executor";

export interface IdempotencyStore extends IdempotencyExecutor {
  isProcessed(key: string): Promise<boolean>;
  markProcessed(key: string, result: unknown, ttl?: number): Promise<void>;
  clear(key: string): Promise<boolean>;
  clearStore(): Promise<void>;
  getResult(key: string): Promise<unknown | undefined>;
  prune(): Promise<number>;
  /** Operator/adapter-confirmed resolution only; never infer non-commit from a timeout. */
  resolveUnknownCommit(key: string, outcome:
    | { status: "not-committed" }
    | { status: "committed"; execution?: IdempotencyExecution<unknown> | undefined }): Promise<void>;
}
