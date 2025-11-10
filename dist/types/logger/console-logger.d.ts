import { Logger } from "./";
declare const LOG_LEVELS: {
    ERROR: number;
    WARN: number;
    DEBUG: number;
    INFO: number;
    LOG: number;
};
export declare class ConsoleLogger extends Logger {
    private readonly level;
    constructor(level: keyof typeof LOG_LEVELS);
    log(context?: Record<string, unknown>, ...args: any[]): void;
    info(context?: Record<string, unknown>, ...args: any[]): void;
    debug(context?: Record<string, unknown>, ...args: any[]): void;
    warn(context?: Record<string, unknown>, ...args: any[]): void;
    error(context?: Record<string, unknown>, ...args: any[]): void;
    private context;
    private shouldLog;
}
export {};
//# sourceMappingURL=console-logger.d.ts.map