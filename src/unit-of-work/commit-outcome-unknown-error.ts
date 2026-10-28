export class CommitOutcomeUnknownError extends Error {
  constructor(cause: unknown, readonly idempotencyKey?: string) {
    super("Commit outcome is unknown; reconcile with durable storage before retrying", { cause });
    this.name = "CommitOutcomeUnknownError";
  }
}
