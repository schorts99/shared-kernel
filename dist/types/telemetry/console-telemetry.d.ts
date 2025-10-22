import { Telemetry } from "./telemetry";
export declare class ConsoleTelemetry implements Telemetry {
    private readonly customContext;
    private transaction;
    init(): void;
    trackError(error: Error): void;
    setCustomContext(key: string, value: string): void;
    setTransaction(name: string): void;
}
//# sourceMappingURL=console-telemetry.d.ts.map