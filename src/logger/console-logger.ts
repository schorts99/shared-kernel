import { Logger } from "./";

const LOG_LEVELS = {
  ERROR: 5,
  WARN: 4,
  DEBUG: 3,
  INFO: 2,
  LOG: 1,
};

export class ConsoleLogger extends Logger {
  constructor(
    private readonly level: "LOG" | "ERROR" | "WARN" | "INFO" | "DEBUG" = "ERROR",
  ) {
    super();
  }

  log(context?: Record<string, unknown>, ...args: any[]): void {
    if (LOG_LEVELS[this.level] < LOG_LEVELS["LOG"]) return;

    console.log(this.context(context), ...args);
  }

  info(context?: Record<string, unknown>, ...args: any[]): void {
    if (LOG_LEVELS[this.level] < LOG_LEVELS["INFO"]) return;

    console.info(this.context(context), ...args);
  }

  debug(context?: Record<string, unknown>, ...args: any[]): void {
    if (LOG_LEVELS[this.level] < LOG_LEVELS["DEBUG"]) return;

    console.debug(this.context(context), ...args);
  }

  warn(context?: Record<string, unknown>, ...args: any[]): void {
    if (LOG_LEVELS[this.level] < LOG_LEVELS["WARN"]) return;

    console.warn(this.context(context), ...args);
  }

  error(context?: Record<string, unknown>, ...args: any[]): void {
    if (LOG_LEVELS[this.level] < LOG_LEVELS["ERROR"]) return;

    console.error(this.context(context), ...args);
  }

  private context(customContext?: Record<string, unknown>) {
    return {
      timestamp: Date.now(),
      ...customContext,
    };
  }
}
