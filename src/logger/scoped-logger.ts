import { Logger } from "./";

export class ScopedLogger extends Logger {
  constructor(
    private readonly base: Logger,
    private readonly baseContext: Record<string, unknown>
  ) {
    super();
  }

  log(context?: Record<string, unknown>, ...args: any[]) {
    this.base.log({ ...this.baseContext, ...context }, ...args);
  }

  info(context?: Record<string, unknown>, ...args: any[]) {
    this.base.info({ ...this.baseContext, ...context }, ...args);
  }

  debug(context?: Record<string, unknown>, ...args: any[]) {
    this.base.debug({ ...this.baseContext, ...context }, ...args);
  }

  warn(context?: Record<string, unknown>, ...args: any[]) {
    this.base.warn({ ...this.baseContext, ...context }, ...args);
  }

  error(context?: Record<string, unknown>, ...args: any[]) {
    this.base.error({ ...this.baseContext, ...context }, ...args);
  }

  child(context?: Record<string, unknown>): ScopedLogger {
    return new ScopedLogger(this.base, { ...this.baseContext, ...context });
  }
}
