export interface TrackedError {
  id: string;
  error: Error | string;
  context?: Record<string, unknown>;
  timestamp: Date;
  reason?: string;
}
