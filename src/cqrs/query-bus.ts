import { Query } from "./query";
import { QueryHandler } from "./query-handler";

export interface QueryBus {
  register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>): void;
  dispatch<Q extends Query, R>(query: Q): Promise<R>;
}
