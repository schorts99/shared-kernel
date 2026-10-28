import { cloneValue } from "../../utils/index.js";
import { LogLevel } from "../console/index.js";
import { Logger, LogContext } from "../logger.js";

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  log: 2,
  warn: 3,
  error: 4,
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  timestamp: Date;
}

export class InMemoryLogger extends Logger {
  private readonly entries: LogEntry[] = [];
  private readonly levelValue: number;

  constructor(level: LogLevel = "debug") {
    super();
    this.levelValue = LOG_LEVEL_VALUES[level];
  }

  log(message: string, context?: LogContext): void {
    this.record("log", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.record("info", message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.record("debug", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.record("warn", message, context);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.record("error", message, context, error);
  }

  getEntries(): LogEntry[] {
    return this.entries.map(entry => cloneValue(entry));
  }

  getByLevel(level: LogLevel): LogEntry[] {
    return this.entries
      .filter(entry => entry.level === level)
      .map(entry => cloneValue(entry));
  }

  clear(): void {
    this.entries.length = 0;
  }

  private record(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (LOG_LEVEL_VALUES[level] < this.levelValue) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
    };

    if (context !== undefined) {
      entry.context = cloneValue(context);
    }

    if (error !== undefined) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(error.stack !== undefined ? { stack: error.stack } : {}),
      };
    }

    this.entries.push(entry);
  }
}
