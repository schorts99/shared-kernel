import { Query } from "./query";
import { QueryMetadata, QueryPrimitives } from "./query-metadata";
import { QueryNotRegistered } from "./exceptions";

export type QueryConstructor = {
  new (
    correlationId: string,
    payload: any,
    metadata?: Partial<QueryMetadata>,
  ): Query;
};

export class QueryRegistry {
  private static readonly registry = new Map<string, QueryConstructor>();

  static register(
    queryType: string,
    constructor: QueryConstructor,
  ): void {
    this.registry.set(queryType, constructor);
  }

  static fromPrimitives(primitives: QueryPrimitives): Query {
    const Constructor = this.registry.get(primitives.type);

    if (!Constructor) {
      throw new QueryNotRegistered(primitives.type);
    }

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
