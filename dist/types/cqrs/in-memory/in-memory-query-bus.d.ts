import { Query, QueryBus, QueryHandler } from "../";
export declare class InMemoryQueryBus implements QueryBus {
    private readonly handlers;
    register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>): void;
    dispatch<Q extends Query, R>(query: Q): Promise<R>;
}
//# sourceMappingURL=in-memory-query-bus.d.ts.map