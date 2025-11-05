import { ScopedLogger } from "./";

export abstract class Logger {
  abstract log(context?: Record<string, unknown>, ...args: any[]): void;
  abstract info(context?: Record<string, unknown>, ...args: any[]): void;
  abstract debug(context?: Record<string, unknown>, ...args: any[]): void;
  abstract warn(context?: Record<string, unknown>, ...args: any[]): void;
  abstract error(context?: Record<string, unknown>, ...args: any[]): void;
  
  child(context: Record<string, unknown>): ScopedLogger {
    return new ScopedLogger(this, context);
  }
}
