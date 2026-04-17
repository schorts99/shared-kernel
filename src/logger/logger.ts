import { ScopedLogger } from "./scoped-logger";

export type LogContext = Record<string, unknown>;

export abstract class Logger {
  abstract log(message: string, context?: LogContext): void;
  abstract info(message: string, context?: LogContext): void;
  abstract debug(message: string, context?: LogContext): void;
  abstract warn(message: string, context?: LogContext): void;
  abstract error(message: string, context?: LogContext, error?: Error): void;

  child(context: LogContext): Logger {
    return new ScopedLogger(this, context);
  }
}
