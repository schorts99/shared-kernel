import { Logger, LogContext } from "./logger";

export class ScopedLogger extends Logger {
  constructor(
    private readonly base: Logger,
    private readonly baseContext: LogContext
  ) {
    super();
  }

  log(message: string, context?: LogContext) {
    this.base.log(message, { ...this.baseContext, ...context });
  }

  info(message: string, context?: LogContext) {
    this.base.info(message, { ...this.baseContext, ...context });
  }

  debug(message: string, context?: LogContext) {
    this.base.debug(message, { ...this.baseContext, ...context });
  }

  warn(message: string, context?: LogContext) {
    this.base.warn(message, { ...this.baseContext, ...context });
  }

  error(message: string, context?: LogContext, error?: Error) {
    this.base.error(message, { ...this.baseContext, ...context }, error);
  }

  child(context: LogContext): ScopedLogger {
    return new ScopedLogger(this.base, { ...this.baseContext, ...context });
  }
}
