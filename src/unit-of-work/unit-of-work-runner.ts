import { UnitOfWork } from "./unit-of-work";
import { MaybePromise } from "../types";

export interface UnitOfWorkRunner<IsAsync extends boolean = false> {
  run<Result>(
    operation: (uow: UnitOfWork<IsAsync>) => MaybePromise<IsAsync, Result>,
  ): MaybePromise<IsAsync, Result>;
}
