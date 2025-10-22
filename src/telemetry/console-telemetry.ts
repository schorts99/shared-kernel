import { Telemetry } from "./telemetry";

export class ConsoleTelemetry implements Telemetry {
  private readonly customContext: Record<string, string> = {};
  private transaction: string | null = null;

  init(): void {
    console.log("Telemetry initialized");
  }

  trackError(error: Error): void {
    console.error({
      error,
      timestamp: new Date(),
      customContext: this.customContext,
      transaction: this.transaction,
    });
  }

  setCustomContext(key: string, value: string): void {
    this.customContext[key] = value;
  }

  setTransaction(name: string): void {
    this.transaction = name;
  }
}
