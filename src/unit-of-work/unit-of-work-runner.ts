import { UnitOfWork } from "./unit-of-work";

export interface UnitOfWorkRunner {
  run<Result>(operation: (uow: UnitOfWork) => Promise<Result>): Promise<Result>;
}
