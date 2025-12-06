import { Query, QueryBus, QueryHandler, QueryNotRegistered } from "../../index";

export class SyncInMemoryQueryBus implements QueryBus<true> {
  private readonly handlers = new Map<string, QueryHandler>();

  register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>): void {
    this.handlers.set(type, handler);
  }

  async dispatch<Q extends Query, R>(query: Q) {
    const handler = this.handlers.get(query.getType()) as QueryHandler<Q, R> | undefined;

    if (!handler) {
      throw new QueryNotRegistered(query.getType());
    }

    return await handler.handle(query);
  }
}
