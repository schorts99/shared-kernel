import { Query } from "./query.js";
import { QueryMetadata, QueryPrimitives } from "./query-metadata.js";
import { QueryNotRegistered } from "./exceptions/index.js";

export type QueryFactory<Q extends Query = Query> = (
  primitives: QueryPrimitives,
) => Q;

export type QueryConstructor<Q extends Query = Query> =
  | {
      new (...args: any[]): Q;
      fromPrimitives(primitives: QueryPrimitives): Q;
    }
  | {
      new (
        correlationId: string,
        payload: any,
        metadata?: Partial<QueryMetadata>,
      ): Q;
      fromPrimitives?(primitives: QueryPrimitives): Q;
    };

export type QueryRegistration<Q extends Query = Query> =
  | QueryConstructor<Q>
  | QueryFactory<Q>;

function isClassConstructor(fn: unknown): fn is new (...args: any[]) => Query {
  return (
    typeof fn === "function" &&
    fn.prototype !== undefined &&
    fn.prototype.constructor === fn
  );
}

export class QueryRegistry {
  private static readonly registry = new Map<string, QueryRegistration>();

  static register<Q extends Query = Query>(
    queryType: string,
    constructorOrFactory: QueryRegistration<Q>,
  ): void {
    this.registry.set(queryType, constructorOrFactory);
  }

  static has(queryType: string): boolean {
    return this.registry.has(queryType);
  }

  static unregister(queryType: string): boolean {
    return this.registry.delete(queryType);
  }

  static clear(): void {
    this.registry.clear();
  }

  static fromPrimitives<Q extends Query = Query>(primitives: QueryPrimitives): Q {
    const registered = this.registry.get(primitives.type);

    if (!registered) {
      throw new QueryNotRegistered(primitives.type);
    }

    if (typeof (registered as { fromPrimitives?: unknown }).fromPrimitives === "function") {
      return (registered as unknown as { fromPrimitives(p: QueryPrimitives): Q }).fromPrimitives(
        primitives,
      );
    }

    if (!isClassConstructor(registered)) {
      return (registered as unknown as QueryFactory<Q>)(primitives);
    }

    const Constructor = registered as unknown as new (
      correlationId: string,
      payload: any,
      metadata?: Partial<QueryMetadata>,
    ) => Q;

    return new Constructor(
      primitives.correlation_id,
      primitives.payload,
      {
        id: primitives.id,
        createdAt: new Date(primitives.created_at),
        correlationId: primitives.correlation_id,
        causationId: primitives.causation_id,
        requestId: primitives.request_id,
        version: primitives.version,
        userId: primitives.user_id,
        tenantId: primitives.tenant_id,
        headers: primitives.headers,
        context: primitives.context,
      },
    );
  }
}

export function QueryMapping(queryType: string) {
  return function (constructor: QueryConstructor) {
    QueryRegistry.register(queryType, constructor);
  };
}
