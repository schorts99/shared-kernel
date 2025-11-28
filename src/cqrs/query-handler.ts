import { Query } from "./query";
import { MaybePromise } from "../types";

export interface QueryHandler<Q extends Query = Query, R = unknown, IsAsync extends boolean = false> {
  handle(query: Q): MaybePromise<IsAsync, R>;
}
