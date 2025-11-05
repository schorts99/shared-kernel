import { Logger } from "./";
export declare class ConsoleLogger extends Logger {
    log(context?: Record<string, unknown>, ...args: any[]): void;
    info(context?: Record<string, unknown>, ...args: any[]): void;
    debug(context?: Record<string, unknown>, ...args: any[]): void;
    warn(context?: Record<string, unknown>, ...args: any[]): void;
    error(context?: Record<string, unknown>, ...args: any[]): void;
    private context;
}
//# sourceMappingURL=console-logger.d.ts.map