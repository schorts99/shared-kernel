import { Query } from "./query";
import { QueryValidationError, QueryAuthorizationError, QueryExecutionError } from "./exceptions";
import { Logger } from "../logger";
import { Cache } from "../cache";

export interface QueryHandlerOptions {
  cache?: boolean;
  cacheTtl?: number;
  logging?: boolean;
  metrics?: boolean;
  timeout?: number;
  cacheStore?: Cache;
  logger?: Logger;
}

export interface QueryHandlerContext {
  metadata: Query["getMetadata"];
  options: QueryHandlerOptions;
  startTime: Date;
  correlationId: string;
}

export interface QueryHandler<Q extends Query = Query, R = unknown> {
  handle(query: Q, context?: QueryHandlerContext): Promise<R>;

  getOptions?(): QueryHandlerOptions;

  validate?(query: Q): Promise<void>;

  authorize?(query: Q): Promise<void>;

  execute(query: Q, context?: QueryHandlerContext): Promise<R>;

  getCacheKey?(query: Q): string | null;

  shouldCache?(query: Q, result: R): boolean;

  getCacheTags?(query: Q, result: R): string[];

  serializeResult?(result: R): unknown;

  deserializeResult?(payload: unknown): R;
}

export abstract class AbstractQueryHandler<Q extends Query = Query, R = unknown>
  implements QueryHandler<Q, R> {

  protected readonly options: QueryHandlerOptions;
  protected readonly cache?: Cache | undefined;
  protected readonly logger?: Logger | undefined;

  constructor(options: QueryHandlerOptions = {}) {
    this.options = {
      cache: false,
      cacheTtl: 5 * 60 * 1000,
      logging: false,
      metrics: false,
      ...options,
    };
    this.cache = options.cacheStore;
    this.logger = options.logger;
  }

  async handle(query: Q, context?: QueryHandlerContext): Promise<R> {
    const startTime = new Date();
    const correlationId = query.getMetadata().correlationId;
    const handlerContext: QueryHandlerContext = {
      metadata: query.getMetadata.bind(query),
      options: this.options,
      startTime,
      correlationId,
      ...context,
    };

    try {
      await this.validate(query);
      await this.authorize(query);

      if (this.options.cache && this.cache) {
        const cacheKey = this.getCacheKey?.(query);

        if (cacheKey) {
          const cachedResult = await this.cache.get(cacheKey);

          if (cachedResult !== undefined) {
            if (this.options.logging) {
              this.logQuery(query, cachedResult as R, startTime, true);
            }

            return this.deserializeResult(cachedResult)
          }
        }
      }

      const result = await this.execute(query, handlerContext);

      if (this.options.cache && this.cache && this.shouldCache?.(query, result)) {
        const cacheKey = this.getCacheKey?.(query);

        if (cacheKey) {
          const tags = this.getCacheTags?.(query, result);

          await this.cache.set(
            cacheKey,
            this.serializeResult(result),
            this.options.cacheTtl,
            tags,
          );
        }
      }

      if (this.options.logging) {
        this.logQuery(query, result, startTime);
      }

      return result;
    } catch (error) {
      if (this.options.logging) {
        this.logError(query, error, startTime);
      }

      if (error instanceof QueryValidationError ||
        error instanceof QueryAuthorizationError ||
        error instanceof QueryExecutionError
      ) {
        throw error;
      }

      throw new QueryExecutionError(
        `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
        "QUERY_EXECUTION_FAILED",
        { originalError: error }
      );
    }
  }

  getOptions(): QueryHandlerOptions {
    return this.options;
  }

  public async validate(_: Q): Promise<void> { }

  public async authorize(_: Q): Promise<void> { }

  public abstract execute(query: Q, context: QueryHandlerContext): Promise<R>;

  getCacheKey?(query: Q): string | null {
    return `${query.getType()}:${JSON.stringify(query.toPrimitives?.() ?? {})}`;
  }

  shouldCache?(_: Q, __: R): boolean {
    return true;
  }

  getCacheTags?(_: Q, __: R): string[] {
    return [];
  }

  serializeResult(result: R): unknown {
    return result;
  }

  deserializeResult(payload: unknown): R {
    return payload as R;
  }

  private logQuery(query: Q, result: R, startTime: Date, cached = false): void {
    const duration = Date.now() - startTime.getTime();

    this.logger?.info(`[Query ${query.getType()}] ${cached ? 'served from cache' : 'completed'} in ${duration}ms`, {
      correlationId: query.getMetadata().correlationId,
      userId: query.getMetadata().userId,
      resultSize: this.getResultSize(result),
      cached,
      duration,
    });
  }

  private logError(query: Q, error: any, startTime: Date): void {
    const duration = Date.now() - startTime.getTime();

    this.logger?.error(`[Query ${query.getType()}] failed after ${duration}ms`, {
      correlationId: query.getMetadata().correlationId,
      userId: query.getMetadata().userId,
      duration,
      error: error instanceof Error ? error.message : String(error),
    }, error instanceof Error ? error : undefined);
  }

  private getResultSize(result: R): string {
    try {
      const size = JSON.stringify(result).length;

      if (size < 1024) return `${size} bytes`;
      if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

      return `${Math.round(size / (1024 * 1024))} MB`;
    } catch {
      return "unknown";
    }
  }
}
