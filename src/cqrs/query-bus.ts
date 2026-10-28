import { Query } from "./query.js";
import { QueryHandler } from "./query-handler.js";
import type { BusMetrics, BusRuntimeConfig, BusDispatchOptions, BusCloseOptions } from "./bus-runtime.js";
import type { QueryCachePolicy } from "./query-cache-policy.js";

export interface QueryBusMiddleware {
  beforeDispatch?<Q extends Query>(
    query: Q,
    context: QueryBusContext
  ): Promise<void>;

  afterDispatch?<Q extends Query, R>(
    query: Q,
    result: R,
    context: QueryBusContext
  ): Promise<void>;

  onError?<Q extends Query>(
    query: Q,
    error: Error,
    context: QueryBusContext
  ): Promise<void>;
}

export interface QueryBusContext {
  signal?: AbortSignal;
  correlationId: string;
  startTime: Date;
  metadata: Record<string, unknown>;
  config: QueryBusConfig;
}

export interface QueryBusConfig extends BusRuntimeConfig {
  enableMetrics?: boolean;
  enableLogging?: boolean;
  enableCaching?: boolean;
  cacheTtl?: number;
  timeout?: number;
  maxConcurrency?: number;
}

export interface QueryBus {
  register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>, cachePolicy?: QueryCachePolicy<Q, R>): void;

  unregister(type: string): boolean;

  hasHandler(type: string): boolean;

  getRegisteredTypes(): string[];

  dispatch<Q extends Query, R>(query: Q, options?: BusDispatchOptions): Promise<R>;

  dispatchMany<Q extends Query, R>(
    queries: readonly Q[],
    options?: BusDispatchOptions
  ): Promise<R[]>;

  use(middleware: QueryBusMiddleware): void;

  removeMiddleware(middleware: QueryBusMiddleware): boolean;

  getConfig(): QueryBusConfig;

  setConfig(config: Partial<QueryBusConfig>): void;

  clear(): void;
  getMetrics(): BusMetrics;
  drain(): Promise<void>;
  close(options?: BusCloseOptions): Promise<void>;
  /** Omit tags to clear all entries; invalidation also prevents in-flight stale cache writes. */
  invalidateCache(tags?: string[]): Promise<void>;
}
