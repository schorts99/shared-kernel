import { Query, QueryBus, SyncQueryHandler, QueryNotRegistered } from "../../index";

export class SyncInMemoryQueryBus implements QueryBus<true> {
  private readonly handlers = new Map<string, SyncQueryHandler>();

  register<Q extends Query, R>(type: string, handler: SyncQueryHandler<Q, R>): void {
    this.handlers.set(type, handler);
  }

  async dispatch<Q extends Query, R>(query: Q) {
    const handler = this.handlers.get(query.getType()) as SyncQueryHandler<Q, R> | undefined;

    if (!handler) {
      throw new QueryNotRegistered(query.getType());
    }

    return await handler.handle(query);
  }
}
