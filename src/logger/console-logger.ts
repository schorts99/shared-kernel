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
    private readonly level: keyof typeof LOG_LEVELS,
  ) {
    super();
  }

  log(context?: Record<string, unknown>, ...args: any[]): void {
    if (!this.shouldLog("LOG")) return;

    console.log(this.context(context), ...args);
  }

  info(context?: Record<string, unknown>, ...args: any[]): void {
    if (!this.shouldLog("INFO")) return;

    console.info(this.context(context), ...args);
  }

  debug(context?: Record<string, unknown>, ...args: any[]): void {
    if (!this.shouldLog("DEBUG")) return;

    console.debug(this.context(context), ...args);
  }

  warn(context?: Record<string, unknown>, ...args: any[]): void {
    if (!this.shouldLog("WARN")) return;

    console.warn(this.context(context), ...args);
  }

  error(context?: Record<string, unknown>, ...args: any[]): void {
    if (!this.shouldLog("ERROR")) return;

    console.error(this.context(context), ...args);
  }

  private context(customContext?: Record<string, unknown>) {
    return {
      timestamp: Date.now(),
      ...customContext,
    };
  }

  private shouldLog(level: keyof typeof LOG_LEVELS): boolean {
    return LOG_LEVELS[this.level] >= LOG_LEVELS[level];
  }
}
