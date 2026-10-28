import { UnitOfWork } from "./unit-of-work";
import { Logger } from "../logger";
import { CommitOutcomeUnknownError } from "./commit-outcome-unknown-error";

export interface UnitOfWorkRunner {
  run<Result>(
    operation: (uow: UnitOfWork) => Promise<Result>,
  ): Promise<Result>;
}

export abstract class AsyncUnitOfWorkRunner implements UnitOfWorkRunner {
  protected readonly logger?: Logger | undefined;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  protected abstract createUnitOfWork(): UnitOfWork;

  protected resolveCommitOutcome?(
    uow: UnitOfWork,
    error: unknown,
  ): Promise<"committed" | "not-committed" | "unknown">;

  async run<Result>(
    operation: (uow: UnitOfWork) => Promise<Result>,
  ): Promise<Result> {
    const uow = this.createUnitOfWork();
    await uow.begin();
    let commitAttempted = false;

    try {
      const result = await operation(uow);

      commitAttempted = true;
      try {
        await uow.commit();
      } catch (error) {
        if (this.resolveCommitOutcome) {
          let resolution: "committed" | "not-committed" | "unknown";
          try {
            resolution = await this.resolveCommitOutcome(uow, error);
          } catch (resolutionError) {
            throw new CommitOutcomeUnknownError(new AggregateError([error, resolutionError]));
          }
          if (resolution === "committed") return result;
          if (resolution === "not-committed") {
            commitAttempted = false;
            throw error;
          }
        }
        throw error instanceof CommitOutcomeUnknownError ? error : new CommitOutcomeUnknownError(error);
      }

      return result;
    } catch (error) {
      if (commitAttempted) throw error;
      try {
        await uow.rollback();
      } catch (rollbackError) {
        this.logger?.error("Unit of work rollback failed", {
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        }, rollbackError instanceof Error ? rollbackError : undefined);
      }

      throw error;
    }
  }
}
