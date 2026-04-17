import { UnitOfWork } from "./unit-of-work";

export interface UnitOfWorkRunner {
  run<Result>(
    operation: (uow: UnitOfWork) => Promise<Result>,
  ): Promise<Result>;
}

export abstract class AsyncUnitOfWorkRunner implements UnitOfWorkRunner {
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
        console.error("[AsyncUnitOfWorkRunner] Rollback failed:", rollbackError);
      }

      throw error;
    }
  }
}
