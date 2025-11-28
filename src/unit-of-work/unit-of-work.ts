import { MaybePromise } from "../types";

export interface UnitOfWork<IsAsync extends boolean = false> {
  begin(): MaybePromise<IsAsync, void>;
  commit(): MaybePromise<IsAsync, void>;
  rollback(): MaybePromise<IsAsync, void>;
}
