import { Query, QueryBus, QueryHandler } from "../../index";
export declare class SyncInMemoryQueryBus implements QueryBus<true> {
    private readonly handlers;
    register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>): void;
    dispatch<Q extends Query, R>(query: Q): Promise<R>;
}
//# sourceMappingURL=sync-in-memory-query-bus.d.ts.map