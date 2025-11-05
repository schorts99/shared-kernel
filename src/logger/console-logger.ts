import { Logger } from "./";

export class ConsoleLogger extends Logger {
  log(context?: Record<string, unknown>, ...args: any[]): void {
    console.log(this.context(context), ...args);
  }

  info(context?: Record<string, unknown>, ...args: any[]): void {
    console.info(this.context(context), ...args);
  }

  debug(context?: Record<string, unknown>, ...args: any[]): void {
    console.debug(this.context(context), ...args);
  }

  warn(context?: Record<string, unknown>, ...args: any[]): void {
    console.warn(this.context(context), ...args);
  }

  error(context?: Record<string, unknown>, ...args: any[]): void {
    console.error(this.context(context), ...args);
  }

  private context(customContext?: Record<string, unknown>) {
    return {
      timestamp: new Date(),
      ...customContext,
    };
  }
}
