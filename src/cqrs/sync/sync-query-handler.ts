import { Query } from "../query";

export interface SyncQueryHandler<Q extends Query = Query, R = unknown> {
  handle(query: Q): R;
}
