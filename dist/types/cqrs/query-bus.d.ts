import { Query } from "./query";
export interface QueryBus {
    dispatch<Q extends Query, R>(query: Q): Promise<R>;
}
//# sourceMappingURL=query-bus.d.ts.map