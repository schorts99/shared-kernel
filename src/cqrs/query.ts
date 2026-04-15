import { QueryMetadata, QueryPrimitives } from "./query-metadata";

export interface Query {
  getType(): string;

  getMetadata(): QueryMetadata;

  toPrimitives?(): QueryPrimitives;
}

export abstract class AbstractQuery implements Query {
  protected readonly metadata: QueryMetadata;

  constructor(correlationId: string, customMetadata?: Partial<QueryMetadata>) {
    const generateId = () =>
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.metadata = {
      id: customMetadata?.id ?? generateId(),
      createdAt: customMetadata?.createdAt ?? new Date(),
      correlationId:
        customMetadata?.correlationId ?? correlationId,
      causationId: customMetadata?.causationId,
      requestId: customMetadata?.requestId,
      version: customMetadata?.version ?? 1,
      userId: customMetadata?.userId,
      tenantId: customMetadata?.tenantId,
      headers: customMetadata?.headers,
      context: customMetadata?.context,
    };
  }

  abstract getType(): string;

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
      payload: {},
      headers: this.metadata.headers,
      context: this.metadata.context,
    };
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
