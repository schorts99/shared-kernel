import {
  Query,
  QueryBus,
  QueryHandler,
  QueryNotRegistered,
  QueryBusMiddleware,
  QueryBusContext,
  QueryBusConfig
} from "..";

export class InMemoryQueryBus implements QueryBus {
  private readonly handlers = new Map<string, QueryHandler<Query, unknown>>();
  private readonly middleware: QueryBusMiddleware[] = [];
  private config: QueryBusConfig = {
    enableMetrics: false,
    enableCaching: false,
    cacheTtl: 0,
    timeout: 0,
    maxConcurrency: 1,
  };

  register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>): void {
    if (this.handlers.has(type)) {
      throw new Error(`Handler for query type '${type}' is already registered`);
    }

    this.handlers.set(type, handler as QueryHandler<Query, unknown>);
  }

  unregister(type: string): boolean {
    return this.handlers.delete(type);
  }

  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  async dispatch<Q extends Query, R>(query: Q): Promise<R> {
    const handler = this.handlers.get(query.getType()) as QueryHandler<Q, R> | undefined;

    if (!handler) {
      throw new QueryNotRegistered(query.getType());
    }

    const startTime = new Date();
    const correlationId = query.getMetadata().correlationId;
    const context: QueryBusContext = {
      correlationId,
      startTime,
      metadata: query.getMetadata() as Record<string, any>,
      config: this.config,
    };

    try {
      for (const mw of this.middleware) {
        if (mw.beforeDispatch) {
          await mw.beforeDispatch(query, context);
        }
      }

      const result = await handler.handle(query);

      for (const mw of this.middleware) {
        if (mw.afterDispatch) {
          await mw.afterDispatch(query, result, context);
        }
      }

      return result;
    } catch (error) {
      for (const mw of this.middleware) {
        if (mw.onError) {
          await mw.onError(query, error as Error, context);
        }
      }

      throw error;
    }
  }

  async dispatchMany<Q extends Query, R>(queries: readonly Q[]): Promise<R[]> {
    const results: R[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    for (const query of queries) {
      try {
        results.push(await this.dispatch(query));
      } catch (error) {
        errors.push({ index: results.length, error: error as Error });
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors.map((e) => e.error),
        `${errors.length} query(s) failed during bulk dispatch`
      );
    }

    return results;
  }

  use(middleware: QueryBusMiddleware): void {
    this.middleware.push(middleware);
  }

  removeMiddleware(middleware: QueryBusMiddleware): boolean {
    const index = this.middleware.indexOf(middleware);

    if (index >= 0) {
      this.middleware.splice(index, 1);
      return true;
    }

    return false;
  }

  getConfig(): QueryBusConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<QueryBusConfig>): void {
    this.config = { ...this.config, ...config };
  }

  clear(): void {
    this.handlers.clear();
    this.middleware.length = 0;
  }
}
