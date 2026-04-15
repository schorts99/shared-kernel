import { Query } from "./query";
import { QueryHandler } from "./query-handler";

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
  correlationId: string;
  startTime: Date;
  metadata: Record<string, any>;
  config: QueryBusConfig;
}

export interface QueryBusConfig {
  enableMetrics?: boolean;
  enableCaching?: boolean;
  cacheTtl?: number;
  timeout?: number;
  maxConcurrency?: number;
}

export interface QueryBus {
  register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>): void;

  unregister(type: string): boolean;

  hasHandler(type: string): boolean;

  getRegisteredTypes(): string[];

  dispatch<Q extends Query, R>(query: Q): Promise<R>;

  dispatchMany<Q extends Query, R>(
    queries: readonly Q[]
  ): Promise<R[]>;

  use(middleware: QueryBusMiddleware): void;

  removeMiddleware(middleware: QueryBusMiddleware): boolean;

  getConfig(): QueryBusConfig;

  setConfig(config: Partial<QueryBusConfig>): void;

  clear(): void;
}
