import { Query, QueryBus, QueryHandler } from "..";
export declare class AsyncInMemoryQueryBus implements QueryBus<true> {
    private readonly handlers;
    register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>): void;
    dispatch<Q extends Query, R>(query: Q): Promise<R>;
}
//# sourceMappingURL=async-in-memory-query-bus.d.ts.map