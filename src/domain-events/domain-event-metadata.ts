export interface DomainEventMetadata {
  id: string;
  occurredAt: Date;
  correlationId: string;
  causationId: string | undefined;
  requestId: string | undefined;
  version: number;
  userId: string | undefined;
  tenantId: string | undefined;
  retries: number;
  headers: Record<string, string> | undefined;
  context: Record<string, any> | undefined;
}

export interface DomainEventPrimitives {
  id: string;
  type: string;
  occurred_at: string;
  correlation_id: string;
  causation_id: string | undefined;
  request_id: string | undefined;
  version: number;
  user_id: string | undefined;
  tenant_id: string | undefined;
  payload: Record<string, any>;
  meta: {
    retries: number;
    headers: Record<string, string> | undefined;
    context: Record<string, any> | undefined;
  };
}
