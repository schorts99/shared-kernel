import { Query } from "../query";

export interface AsyncQueryHandler<Q extends Query = Query, R = unknown> {
  handle(query: Q): Promise<R>;
}
