import { QueryMetadata, QueryPrimitives } from "./query-metadata";

export interface Query<T = any> {
  getType(): string;
  getMetadata(): QueryMetadata;
  getPayload?(): T;
  toPrimitives(): QueryPrimitives;
}

export abstract class AbstractQuery<T = any> implements Query<T> {
  protected readonly payload: T;
  protected readonly metadata: QueryMetadata;

  get id(): string {
    return this.metadata.id;
  }

  get createdAt(): Date {
    return this.metadata.createdAt;
  }

  get correlationId(): string {
    return this.metadata.correlationId;
  }

  get causationId(): string | null {
    return this.metadata.causationId ?? null;
  }

  get requestId(): string | null {
    return this.metadata.requestId ?? null;
  }

  get version(): number {
    return this.metadata.version;
  }

  get userId(): string | null {
    return this.metadata.userId ?? null;
  }

  get tenantId(): string | null {
    return this.metadata.tenantId ?? null;
  }

  get headers(): Record<string, string> | null {
    return this.metadata.headers ?? null;
  }

  get context(): Record<string, any> | null {
    return this.metadata.context ?? null;
  }

  constructor(
    correlationId: string,
    payload: T,
    customMetadata?: Partial<QueryMetadata>,
  ) {
    this.payload = payload;
    const generateId = () =>
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      id: customMetadata?.id ?? generateId(),
      createdAt: customMetadata?.createdAt ?? new Date(),
      correlationId:
        customMetadata?.correlationId ?? correlationId,
      causationId: customMetadata?.causationId || null,
      requestId: customMetadata?.requestId || null,
      version: customMetadata?.version ?? 1,
      userId: customMetadata?.userId || null,
      tenantId: customMetadata?.tenantId || null,
      headers: customMetadata?.headers || null,
      context: customMetadata?.context || null,
    };
  }

  abstract getType(): string;

  getPayload(): T {
    return this.payload;
  }

  getMetadata(): QueryMetadata {
    return this.metadata;
  }

  toPrimitives(): QueryPrimitives {
    return {
      id: this.metadata.id,
      type: this.getType(),
      created_at: this.metadata.createdAt.toISOString(),
      correlation_id: this.metadata.correlationId,
      causation_id: this.metadata.causationId,
      request_id: this.metadata.requestId,
      version: this.metadata.version,
      user_id: this.metadata.userId,
      tenant_id: this.metadata.tenantId,
      payload: this.payload as Record<string, any>,
      headers: this.metadata.headers,
      context: this.metadata.context,
    };
  }

  static fromPrimitives<Q extends Query = Query>(
    this: new (
      correlationId: string,
      payload: any,
      customMetadata?: Partial<QueryMetadata>,
    ) => Q,
    primitives: QueryPrimitives,
  ): Q {
    return new this(
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

  setCorrelationId(correlationId: string): void {
    (this.metadata as any).correlationId = correlationId;
  }

  setCausationId(causationId: string): void {
    (this.metadata as any).causationId = causationId;
  }

  setUserId(userId: string): void {
    (this.metadata as any).userId = userId;
  }

  setTenantId(tenantId: string): void {
    (this.metadata as any).tenantId = tenantId;
  }

  addHeaders(headers: Record<string, string>): void {
    this.metadata.headers = {
      ...(this.metadata.headers ?? {}),
      ...headers,
    };
  }

  addContext(key: string, value: any): void {
    this.metadata.context = {
      ...(this.metadata.context ?? {}),
      [key]: value,
    };
  }
}
