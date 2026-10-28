import { QueryMetadata, QueryPrimitives } from "./query-metadata";
import { cloneValue } from "../utils/object";

function cloneSafe<T>(value: T): T {
  try {
    return cloneValue(value);
  } catch {
    return value;
  }
}

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
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.metadata = {
      id: customMetadata?.id ?? generateId(),
      createdAt:
        customMetadata?.createdAt instanceof Date
          ? new Date(customMetadata.createdAt.getTime())
          : new Date(),
      correlationId:
        customMetadata?.correlationId ?? correlationId,
      causationId: customMetadata?.causationId ?? null,
      requestId: customMetadata?.requestId ?? null,
      version: customMetadata?.version ?? 1,
      userId: customMetadata?.userId ?? null,
      tenantId: customMetadata?.tenantId ?? null,
      headers: customMetadata?.headers ? { ...customMetadata.headers } : null,
      context: customMetadata?.context ? cloneSafe(customMetadata.context) : null,
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
      payload: cloneSafe(this.payload) as Record<string, any>,
      headers: this.metadata.headers ? { ...this.metadata.headers } : null,
      context: this.metadata.context ? cloneSafe(this.metadata.context) : null,
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
      cloneSafe(primitives.payload),
      {
        id: primitives.id,
        createdAt: new Date(primitives.created_at),
        correlationId: primitives.correlation_id,
        causationId: primitives.causation_id,
        requestId: primitives.request_id,
        version: primitives.version,
        userId: primitives.user_id,
        tenantId: primitives.tenant_id,
        headers: primitives.headers ? { ...primitives.headers } : null,
        context: primitives.context ? cloneSafe(primitives.context) : null,
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
