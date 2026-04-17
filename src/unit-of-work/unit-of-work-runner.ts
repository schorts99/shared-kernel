import { UnitOfWork } from "./unit-of-work";
import { Logger } from "../logger";

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

  async run<Result>(
    operation: (uow: UnitOfWork) => Promise<Result>,
  ): Promise<Result> {
    const uow = this.createUnitOfWork();
    await uow.begin();

    try {
      const result = await operation(uow);

      await uow.commit();

      return result;
    } catch (error) {
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
