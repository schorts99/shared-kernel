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
import type { BusDispatchOptions, BusCloseOptions } from "../bus-runtime";
import type { Logger } from "../../logger";
import { InMemoryCache } from "../../cache";
import { getExpirationTime } from "../../utils/expiration";
import { cloneValue } from "../../utils/object";
import type { ExecutionContext } from "../../types/execution-context";
import type { QueryCachePolicy } from "../query-cache-policy";

export interface InMemoryQueryBusDependencies {
  executionContext?: ExecutionContext;
  logger?: Logger;
  cloneResult?: (value: unknown) => unknown;
}

export class InMemoryQueryBus implements QueryBus {
  private readonly handlers = new Map<string, QueryHandler<Query, unknown>>();
  private readonly middleware: QueryBusMiddleware[] = [];
  private readonly runtime: BusRuntime;
  private readonly cache: InMemoryCache<{ result: unknown }>;
  private readonly cloneResult: ((value: unknown) => unknown) | undefined;
  private cacheGeneration = 0;
  private readonly cachePolicies = new Map<string, QueryCachePolicy>();

  async invalidateCache(tags?: string[]): Promise<void> {
    this.cacheGeneration++;
    if (tags === undefined) {
      await this.cache.clear();
    } else {
      await this.cache.deleteByTags(tags);
    }
  }

  private clearCache(): void {
    this.cacheGeneration++;
    void this.cache.clear();
  }

  constructor(dependencies: InMemoryQueryBusDependencies = {}) {
    this.runtime = new BusRuntime(dependencies.logger, dependencies.executionContext);
    this.cloneResult = dependencies.cloneResult;
    this.cache = new InMemoryCache<{ result: unknown }>({
      maxEntries: 10_000,
      cloneValue: entry => ({
        result: this.cloneResult ? this.cloneResult(entry.result) : cloneValue(entry.result),
      }),
    });
  }

  getMetrics() {
    return this.runtime.getMetrics();
  }
  drain(): Promise<void> { return this.runtime.drain(); }
  close(options?: BusCloseOptions): Promise<void> { return this.runtime.close(options); }
  private config: QueryBusConfig = {
    enableMetrics: false,
    enableCaching: false,
    cacheTtl: 5 * 60 * 1000,
    timeout: 0,
  };

  register<Q extends Query, R>(
    type: string,
    handler: QueryHandler<Q, R>,
    cachePolicy?: QueryCachePolicy<Q, R>,
  ): void {
    if (this.handlers.has(type)) {
      throw new Error(`Handler for query type '${type}' is already registered`);
    }

    if (cachePolicy) {
      getExpirationTime(cachePolicy.ttl);
      if (handler.getOptions?.().cache) {
        throw new Error("Choose either bus-owned or handler-owned caching, not both");
      }
      if (!handler.validate || !handler.authorize) {
        throw new Error("Bus caching requires explicit validation and authorization hooks");
      }
      this.cachePolicies.set(type, cachePolicy as QueryCachePolicy);
    }
    this.handlers.set(type, handler as QueryHandler<Query, unknown>);
    this.clearCache();
  }

  unregister(type: string): boolean {
    this.cachePolicies.delete(type);
    this.clearCache();
    return this.handlers.delete(type);
  }

  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  async dispatch<Q extends Query, R>(query: Q, options?: BusDispatchOptions): Promise<R> {
    const config = this.getConfig();
    const queryType = query.getType();
    const primitives = query.toPrimitives();
    const dispatchKey = `query:${queryType}:${JSON.stringify(primitives.payload)}`;
    return this.runtime.run(
      queryType,
      config,
      signal => this.execute<Q, R>(query, config, signal),
      {
        ...options,
        label: `query:${queryType}`,
        dispatchKey,
      },
    );
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
    const ctorFromPrimitives = (query.constructor as { fromPrimitives?: (p: any) => Q })
      ?.fromPrimitives;
    const deserializedQuery = QueryRegistry.has(primitives.type)
      ? (QueryRegistry.fromPrimitives(primitives) as Q)
      : typeof ctorFromPrimitives === "function"
        ? ctorFromPrimitives.call(query.constructor, cloneValue(primitives))
        : (QueryRegistry.fromPrimitives(primitives) as Q);
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

      const policy = config.enableCaching ? (this.cachePolicies.get(queryType) as QueryCachePolicy<Q, R> | undefined) : undefined;
      if (policy && handler.getOptions?.().cache) {
        throw new Error("Choose either bus-owned or handler-owned caching, not both");
      }
      const handlerContext = {
        metadata: deserializedQuery.getMetadata.bind(deserializedQuery),
        options: handler.getOptions?.() ?? {},
        startTime,
        correlationId,
        signal,
        validationManagedByBus: policy !== undefined,
      };
      // Validation and authorization must also run on cache hits.
      if (policy) {
        if (!handler.validate || !handler.authorize) {
          throw new Error("Bus caching requires explicit validation and authorization hooks");
        }
        await handler.validate(deserializedQuery);
        await handler.authorize(deserializedQuery);
      }
      signal.throwIfAborted();
      const currentPrimitives = deserializedQuery.toPrimitives();
      const handlerKey = policy?.getKey(deserializedQuery);
      const cacheKey = handlerKey === null || handlerKey === undefined ? null : JSON.stringify([
        queryType,
        handlerKey,
        currentPrimitives.user_id,
        currentPrimitives.tenant_id,
        currentPrimitives.headers,
        currentPrimitives.context,
        currentPrimitives.version,
      ]);
      const cached = cacheKey !== null ? await this.cache.get(cacheKey) : undefined;
      let result: R;
      if (cached) {
        const deserialized = handler.deserializeResult ? handler.deserializeResult(cached.result) : cached.result as R;
        result = policy?.cloneResult ? policy.cloneResult(deserialized) : deserialized;
      } else {
        result = await handler.handle(deserializedQuery, handlerContext);
      }
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

      if (policy && cacheKey !== null && !cached &&
        cacheGeneration === this.cacheGeneration &&
        (policy.shouldCache?.(deserializedQuery, result) ?? true)) {
        const tags = policy.getTags?.(deserializedQuery, result);
        const clonedForStore = policy.cloneResult ? policy.cloneResult(result) : result;
        const serializedForStore = handler.serializeResult ? handler.serializeResult(clonedForStore) : clonedForStore;
        await this.cache.set(cacheKey, { result: serializedForStore }, policy.ttl ?? config.cacheTtl, tags);
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
    options?: BusDispatchOptions,
  ): Promise<R[]> {
    const settled = await Promise.allSettled(queries.map(query => this.dispatch<Q, R>(query, options)));
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
    this.runtime.setConcurrency(next.maxConcurrency, next.maxQueueSize);
    this.config = next;
    this.clearCache();
  }

  clear(): void {
    this.handlers.clear();
    this.cachePolicies.clear();
    this.middleware.length = 0;
    this.clearCache();
  }
}
