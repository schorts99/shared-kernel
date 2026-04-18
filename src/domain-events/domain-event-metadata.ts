export interface DomainEventMetadata {
  id: string;
  occurredAt: Date;
  correlationId: string;
  causationId: string | null;
  requestId: string | null;
  version: number;
  userId: string | null;
  tenantId: string | null;
  retries: number;
  headers: Record<string, string> | null;
  context: Record<string, any> | null;
}

export interface DomainEventPrimitives {
  id: string;
  type: string;
  occurred_at: string;
  correlation_id: string;
  causation_id: string | null;
  request_id: string | null;
  version: number;
  user_id: string | null;
  tenant_id: string | null;
  payload: Record<string, any>;
  meta: {
    retries: number;
    headers: Record<string, string> | null;
    context: Record<string, any> | null;
  };
}
