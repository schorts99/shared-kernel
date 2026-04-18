export interface QueryMetadata {
  id: string;
  createdAt: Date;
  correlationId: string;
  causationId: string | null;
  requestId: string | null;
  version: number;
  userId: string | null;
  tenantId: string | null;
  headers: Record<string, string> | null;
  context: Record<string, any> | null;
}

export interface QueryPrimitives {
  id: string;
  type: string;
  created_at: string;
  correlation_id: string;
  causation_id: string | null;
  request_id: string | null;
  version: number;
  user_id: string | null;
  tenant_id: string | null;
  payload: Record<string, any>;
  headers: Record<string, string> | null;
  context: Record<string, any> | null;
}
