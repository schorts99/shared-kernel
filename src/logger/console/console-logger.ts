import { Logger, LogContext } from "../logger";

export type LogLevel = "debug" | "info" | "log" | "warn" | "error";

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  log: 2,
  warn: 3,
  error: 4,
};

export class ConsoleLogger extends Logger {
  private readonly levelValue: number;

  constructor(private readonly level: LogLevel = "info") {
    super();
    this.levelValue = LOG_LEVEL_VALUES[level];
  }

  log(message: string, context?: LogContext): void {
    if (this.shouldLog("log")) {
      console.log(this.format("LOG", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      console.info(this.format("INFO", message, context));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog("debug")) {
      console.debug(this.format("DEBUG", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog("warn")) {
      console.warn(this.format("WARN", message, context));
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog("error")) {
      console.error(this.format("ERROR", message, { ...context, error: error?.message, stack: error?.stack }));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= this.levelValue;
  }

  private format(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : "";

    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }
}
