import { Query } from "../query";
import { AsyncQueryHandler } from "./async-query-handler";

export interface AsyncQueryBus {
  register<Q extends Query, R>(type: string, handler: AsyncQueryHandler<Q, R>): void;
  dispatch<Q extends Query, R>(query: Q): Promise<R>;
}
