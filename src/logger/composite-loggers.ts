import { Logger, LogContext } from "./logger";

export class NullLogger extends Logger {
  log(): void { }
  info(): void { }
  debug(): void { }
  warn(): void { }
  error(): void { }
}

export class CompositeLogger extends Logger {
  constructor(private readonly loggers: Logger[]) {
    super();
  }

  log(message: string, context?: LogContext): void {
    this.loggers.forEach(l => l.log(message, context));
  }

  info(message: string, context?: LogContext): void {
    this.loggers.forEach(l => l.info(message, context));
  }

  debug(message: string, context?: LogContext): void {
    this.loggers.forEach(l => l.debug(message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.loggers.forEach(l => l.warn(message, context));
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.loggers.forEach(l => l.error(message, context, error));
  }
}
