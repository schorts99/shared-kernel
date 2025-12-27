import { Query } from "../query";
import { SyncQueryHandler } from "./sync-query-handler";

export interface SyncQueryBus<IsAsync extends boolean = false> {
  register<Q extends Query, R>(type: string, handler: SyncQueryHandler<Q, R>): void;
  dispatch<Q extends Query, R>(query: Q): R;
}
