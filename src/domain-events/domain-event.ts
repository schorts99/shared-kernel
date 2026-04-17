import { DomainEventMetadata, DomainEventPrimitives } from "./domain-event-metadata";

export abstract class DomainEvent<T = any> {
  protected readonly payload: T;
  protected readonly metadata: DomainEventMetadata;

  get id() {
    return this.metadata.id;
  }

  constructor(
    correlationId: string,
    payload: T,
    customMetadata?: Partial<DomainEventMetadata>,
  ) {
    this.payload = payload;
    const generateId = () =>
      `${Date.now()}-${Math.random().toString(36).substr(2, 11)}`;

    this.metadata = {
      id: customMetadata?.id ?? generateId(),
      occurredAt: customMetadata?.occurredAt ?? new Date(),
      correlationId: customMetadata?.correlationId ?? correlationId,
      causationId: customMetadata?.causationId,
      requestId: customMetadata?.requestId,
      version: customMetadata?.version ?? 1,
      userId: customMetadata?.userId,
      tenantId: customMetadata?.tenantId,
      retries: customMetadata?.retries ?? 0,
      headers: customMetadata?.headers,
      context: customMetadata?.context,
    };
  }

  abstract getEventName(): string;

  getMetadata(): DomainEventMetadata {
    return this.metadata;
  }

  toPrimitives(): DomainEventPrimitives {
    return {
      id: this.metadata.id,
      type: this.getEventName(),
      occurred_at: this.metadata.occurredAt.toISOString(),
      correlation_id: this.metadata.correlationId,
      causation_id: this.metadata.causationId,
      request_id: this.metadata.requestId,
      version: this.metadata.version,
      user_id: this.metadata.userId,
      tenant_id: this.metadata.tenantId,
      payload: this.payload as Record<string, any>,
      meta: {
        retries: this.metadata.retries,
        headers: this.metadata.headers,
        context: this.metadata.context,
      },
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

  ack?: () => void;

  requeue?: (error?: Error) => void;
}
