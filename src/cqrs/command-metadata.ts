export interface CommandMetadata {
  id: string;
  createdAt: Date;
  correlationId: string;
  causationId: string | undefined;
  requestId: string | undefined;
  version: number;
  userId: string | undefined;
  tenantId: string | undefined;
  headers: Record<string, string> | undefined;
  context: Record<string, any> | undefined;
}

export interface CommandPrimitives {
  id: string;
  type: string;
  created_at: string;
  correlation_id: string;
  causation_id: string | undefined;
  request_id: string | undefined;
  version: number;
  user_id: string | undefined;
  tenant_id: string | undefined;
  payload: Record<string, any>;
  headers: Record<string, string> | undefined;
  context: Record<string, any> | undefined;
}
