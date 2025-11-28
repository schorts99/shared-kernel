import { Query } from "./query";
import { QueryHandler } from "./query-handler";
import { MaybePromise } from "../types";

export interface QueryBus<IsAsync extends boolean = false> {
  register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>): void;
  dispatch<Q extends Query, R>(query: Q): MaybePromise<IsAsync, R>;
}
