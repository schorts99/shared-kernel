import type { IdempotencyExecution } from "../idempotency/idempotency-executor";

export class CommitOutcomeUnknownError extends Error {
  readonly stagedExecution?: IdempotencyExecution<unknown> | undefined;

  constructor(
    cause: unknown,
    readonly idempotencyKey?: string,
    stagedExecution?: IdempotencyExecution<unknown>,
  ) {
    super("Commit outcome is unknown; reconcile with durable storage before retrying", { cause });
    this.name = "CommitOutcomeUnknownError";
    this.stagedExecution = stagedExecution;
  }
}
