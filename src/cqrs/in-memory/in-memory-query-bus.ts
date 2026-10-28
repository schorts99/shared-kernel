import {
  Query,
  QueryBus,
  QueryHandler,
  QueryBusMiddleware,
  QueryBusContext,
  QueryBusConfig,
  QueryRegistry,
  QueryHandlerNotRegistered,
} from "..";
import { BusRuntime, validateBusConfig } from "../bus-runtime";
import type { Logger } from "../../logger";
import { InMemoryCache } from "../../cache";
import { getExpirationTime } from "../../utils/expiration";

export interface InMemoryQueryBusDependencies {
  logger?: Logger;
}

export class InMemoryQueryBus implements QueryBus {
  private readonly handlers = new Map<string, QueryHandler<Query, unknown>>();
  private readonly middleware: QueryBusMiddleware[] = [];
  private readonly runtime: BusRuntime;
  private readonly cache = new InMemoryCache<{ result: unknown }>({ maxEntries: 10_000 });
  private cacheGeneration = 0;

  private clearCache(): void {
    this.cacheGeneration++;
    void this.cache.clear();
  }

  constructor(dependencies: InMemoryQueryBusDependencies = {}) {
    this.runtime = new BusRuntime(dependencies.logger);
    this.runtime.setConcurrency(this.config.maxConcurrency);
  }

  getMetrics() {
    return this.runtime.getMetrics();
  }
  private config: QueryBusConfig = {
    enableMetrics: false,
    enableCaching: false,
    cacheTtl: 5 * 60 * 1000,
    timeout: 0,
    maxConcurrency: 1,
  };

  register<Q extends Query, R>(
    type: string,
    handler: QueryHandler<Q, R>,
  ): void {
    if (this.handlers.has(type)) {
      throw new Error(`Handler for query type '${type}' is already registered`);
    }

    this.handlers.set(type, handler as QueryHandler<Query, unknown>);
    this.clearCache();
  }

  unregister(type: string): boolean {
    this.clearCache();
    return this.handlers.delete(type);
  }

  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  async dispatch<Q extends Query, R>(query: Q): Promise<R> {
    const config = this.getConfig();
    return this.runtime.run(query.getType(), config, signal => this.execute<Q, R>(query, config, signal));
  }

  private async execute<Q extends Query, R>(query: Q, config: QueryBusConfig, signal: AbortSignal): Promise<R> {
    const cacheGeneration = this.cacheGeneration;
    const queryType = query.getType();

    const handler = this.handlers.get(queryType) as
      | QueryHandler<Q, R>
      | undefined;

    if (!handler) {
      throw new QueryHandlerNotRegistered(queryType);
    }

    const primitives = query.toPrimitives();
    const deserializedQuery = QueryRegistry.fromPrimitives(
      primitives,
    ) as Q;
    const startTime = new Date();
    const correlationId = deserializedQuery.getMetadata().correlationId;
    const context: QueryBusContext = {
      signal,
      correlationId,
      startTime,
      metadata: deserializedQuery.getMetadata() as Record<string, any>,
      config,
    };

    try {
      signal.throwIfAborted();
      for (const mw of this.middleware) {
        if (mw.beforeDispatch) {
          await mw.beforeDispatch(deserializedQuery, context);
        }
      }

      const handlerContext = {
        metadata: deserializedQuery.getMetadata.bind(deserializedQuery),
        options: handler.getOptions?.() ?? {},
        startTime,
        correlationId,
        signal,
      };
      // Validation and authorization must also run on cache hits.
      if (config.enableCaching) {
        if (!handler.validate || !handler.authorize) {
          throw new Error("Bus caching requires explicit validation and authorization hooks");
        }
        await handler.validate(deserializedQuery);
        await handler.authorize(deserializedQuery);
      }
      const currentPrimitives = deserializedQuery.toPrimitives();
      const handlerKey = handler.getCacheKey?.(deserializedQuery);
      const cacheKey = handlerKey === null ? null : JSON.stringify([
        queryType,
        handlerKey ?? currentPrimitives,
        currentPrimitives.user_id,
        currentPrimitives.tenant_id,
        currentPrimitives.headers,
        currentPrimitives.context,
        currentPrimitives.version,
      ]);
      const cached = config.enableCaching && cacheKey !== null ? await this.cache.get(cacheKey) : undefined;
      const result = cached ? cached.result as R : await handler.handle(deserializedQuery, handlerContext);
      signal.throwIfAborted();

      for (const mw of this.middleware) {
        if (mw.afterDispatch) {
          await mw.afterDispatch(
            deserializedQuery,
            result,
            context,
          );
        }
      }

      if (config.enableCaching && cacheKey !== null && !cached &&
        cacheGeneration === this.cacheGeneration &&
        (handler.shouldCache?.(deserializedQuery, result) ?? true)) {
        await this.cache.set(cacheKey, { result }, config.cacheTtl);
      }
      return result;
    } catch (error) {
      for (const mw of this.middleware) {
        if (mw.onError) {
          await mw.onError(
            deserializedQuery,
            error as Error,
            context,
          );
        }
      }

      throw error;
    }
  }

  async dispatchMany<Q extends Query, R>(
    queries: readonly Q[],
  ): Promise<R[]> {
    const settled = await Promise.allSettled(queries.map(query => this.dispatch<Q, R>(query)));
    const errors = settled.filter(result => result.status === "rejected");
    if (errors.length > 0) {
      throw new AggregateError(
        errors.map(result => result.reason),
        `${errors.length} query(s) failed during bulk dispatch`,
      );
    }

    return settled.map(result => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
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
    const next = {
      ...this.config,
      ...config,
    };
    validateBusConfig(next);
    getExpirationTime(next.cacheTtl);
    this.config = next;
    this.runtime.setConcurrency(next.maxConcurrency);
    this.clearCache();
  }

  clear(): void {
    this.handlers.clear();
    this.middleware.length = 0;
    this.clearCache();
  }
}
