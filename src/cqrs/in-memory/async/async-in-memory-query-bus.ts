import { Query, AsyncQueryBus, AsyncQueryHandler, QueryNotRegistered } from "../../index";

export class AsyncInMemoryQueryBus implements AsyncQueryBus {
  private readonly handlers = new Map<string, AsyncQueryHandler>();

  register<Q extends Query, R>(type: string, handler: AsyncQueryHandler<Q, R>): void {
    this.handlers.set(type, handler);
  }

  async dispatch<Q extends Query, R>(query: Q) {
    const handler = this.handlers.get(query.getType()) as AsyncQueryHandler<Q, R> | undefined;

    if (!handler) {
      throw new QueryNotRegistered(query.getType());
    }

    return await handler.handle(query);
  }
}
