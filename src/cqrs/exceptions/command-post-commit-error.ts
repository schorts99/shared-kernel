export class CommandPostCommitError extends Error {
  readonly committed = true;

  constructor(cause: unknown, readonly canRetryCompletion = false) {
    super(canRetryCompletion
      ? "Command committed, but post-commit completion failed; retry with the same idempotency key"
      : "Command committed, but post-commit completion failed; rerunning the command may repeat side effects",
    { cause });
    this.name = "CommandPostCommitError";
  }
}
