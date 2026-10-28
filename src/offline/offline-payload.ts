export type OfflinePayload = {
  type: string;
  args: Array<unknown>;
  meta?: {
    userId?: string;
    tenantId?: string;
    timestamp?: number;
    retries?: number;
    correlationId?: string;
    origin?: string;
    version?: number;
  }
};
