export interface telemetry {
  init(): void;
  trackError(error: Error): void;
  setCustomContext(key: string, value: string): void;
  setTransaction(name: string): void;
}
