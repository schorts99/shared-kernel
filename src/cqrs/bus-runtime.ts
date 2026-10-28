import { ConsoleLogger } from "../logger";
import type { Logger } from "../logger";

export interface BusMetrics {
  dispatched: number;
  succeeded: number;
  failed: number;
  totalDurationMs: number;
}

export interface BusRuntimeConfig {
  enableMetrics?: boolean;
  enableLogging?: boolean;
  timeout?: number;
  maxConcurrency?: number;
}

export function validateBusConfig(config: BusRuntimeConfig): void {
  if (config.timeout !== undefined &&
    (!Number.isInteger(config.timeout) || config.timeout < 0 || config.timeout > 2_147_483_647)) {
    throw new RangeError("timeout must be an integer between 0 and 2147483647");
  }
  if (config.maxConcurrency !== undefined &&
    (!Number.isSafeInteger(config.maxConcurrency) || config.maxConcurrency < 1)) {
    throw new RangeError("maxConcurrency must be a positive safe integer");
  }
}

export class BusRuntime {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private limit = Infinity;
  private readonly metrics: BusMetrics = { dispatched: 0, succeeded: 0, failed: 0, totalDurationMs: 0 };

  constructor(private readonly logger: Logger = new ConsoleLogger()) {}

  getMetrics(): BusMetrics {
    return { ...this.metrics };
  }

  setConcurrency(limit?: number): void {
    this.limit = limit ?? Infinity;
    this.drain();
  }

  private drain(): void {
    while (this.active < this.limit && this.queue.length > 0) {
      this.active++;
      this.queue.shift()!();
    }
  }

  async run<T>(type: string, config: BusRuntimeConfig, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    await new Promise<void>(resolve => {
      this.queue.push(resolve);
      this.drain();
    });
    const start = Date.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let task: Promise<T> | undefined;

    try {
      if (config.enableMetrics) this.metrics.dispatched++;
      if (config.enableLogging) this.logger.info("Bus dispatch started", { type });

      task = Promise.resolve().then(() => operation(controller.signal));
      const release = () => {
        this.active--;
        this.drain();
      };
      // A timeout cannot stop an uncooperative handler, so keep its slot until it really settles.
      task.then(release, release);

      const timeout = config.timeout ?? 0;
      const result = timeout > 0
        ? await Promise.race([
          task,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              const error = new DOMException(`Bus dispatch timed out after ${timeout}ms`, "TimeoutError");
              controller.abort(error);
              reject(error);
            }, timeout);
          }),
        ])
        : await task;
      if (config.enableLogging) this.logger.info("Bus dispatch completed", { type, durationMs: Date.now() - start });
      if (config.enableMetrics) this.metrics.succeeded++;
      return result;
    } catch (error) {
      if (!task) {
        this.active--;
        this.drain();
      }
      if (config.enableMetrics) this.metrics.failed++;
      if (config.enableLogging) {
        this.logger.error("Bus dispatch failed", { type, durationMs: Date.now() - start },
          error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (config.enableMetrics) this.metrics.totalDurationMs += Date.now() - start;
    }
  }
}
