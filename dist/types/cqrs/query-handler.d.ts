import { Query } from "./query";
export interface QueryHandler<Q extends Query = Query, R = unknown> {
    handle(query: Q): Promise<R>;
}
//# sourceMappingURL=query-handler.d.ts.map