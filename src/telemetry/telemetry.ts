export interface Telemetry {
  init(...args: any[]): void;
  trackError(error: Error): void;
  setCustomContext(key: string, value: string): void;
  setTransaction(name: string): void;
}
