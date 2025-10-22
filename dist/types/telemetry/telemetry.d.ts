export interface Telemetry {
    trackError(error: Error): void;
    setCustomContext(key: string, value: string): void;
    setTransaction(name: string): void;
}
//# sourceMappingURL=telemetry.d.ts.map