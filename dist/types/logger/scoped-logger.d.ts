import { Logger } from "./";
export declare class ScopedLogger extends Logger {
    private readonly base;
    private readonly baseContext;
    constructor(base: Logger, baseContext: Record<string, unknown>);
    log(context?: Record<string, unknown>, ...args: any[]): void;
    info(context?: Record<string, unknown>, ...args: any[]): void;
    debug(context?: Record<string, unknown>, ...args: any[]): void;
    warn(context?: Record<string, unknown>, ...args: any[]): void;
    error(context?: Record<string, unknown>, ...args: any[]): void;
    child(context?: Record<string, unknown>): ScopedLogger;
}
//# sourceMappingURL=scoped-logger.d.ts.map