import { ConsoleLogger } from "../logger";
import type { Logger } from "../logger";
import type { ExecutionContext, ExecutionContextStorage } from "../types/execution-context";

interface ExecutionFrame {
  active: boolean;
  signal: AbortSignal;
  root: { pending: number; release: () => void };
}

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
  /** Limits top-level execution groups; nested dispatch shares its ancestor's slot. */
  maxConcurrency?: number;
  /** Maximum waiting top-level dispatches; defaults to 1,000. */
  maxQueueSize?: number;
  /** Bounds admission/startup waits, including cross-bus dependencies; defaults to 30 seconds. */
  queueTimeout?: number;
  /** Bounds nested dependency waits, including shared in-flight work; defaults to 30 seconds. */
  nestedTimeout?: number;
}

export interface BusDispatchOptions {
  signal?: AbortSignal;
}

export interface BusCloseOptions {
  /** Defaults to true; false rejects waiting work, but still drains active execution. */
  drainQueued?: boolean;
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
  if (config.maxQueueSize !== undefined && (!Number.isSafeInteger(config.maxQueueSize) || config.maxQueueSize < 0)) {
    throw new RangeError("maxQueueSize must be a non-negative safe integer");
  }
  if (config.nestedTimeout !== undefined &&
    (!Number.isInteger(config.nestedTimeout) || config.nestedTimeout < 1 || config.nestedTimeout > 2_147_483_647)) {
    throw new RangeError("nestedTimeout must be a positive timer-safe integer");
  }
  if (config.queueTimeout !== undefined &&
    (!Number.isInteger(config.queueTimeout) || config.queueTimeout < 1 || config.queueTimeout > 2_147_483_647)) {
    throw new RangeError("queueTimeout must be a positive timer-safe integer");
  }
}

export class BusRuntime {
  private active = 0;
  private readonly queue: Array<{ start: () => void; reject: (error: Error) => void }> = [];
  private limit = Infinity;
  private maxQueueSize = 1000;
  private closing = false;
  private readonly drainWaiters = new Set<() => void>();
  private readonly metrics: BusMetrics = { dispatched: 0, succeeded: 0, failed: 0, totalDurationMs: 0 };
  private readonly executionContext: ExecutionContextStorage<ExecutionFrame> | undefined;

  constructor(private readonly logger: Logger = new ConsoleLogger(), executionContext?: ExecutionContext) {
    this.executionContext = executionContext?.createStorage<ExecutionFrame>();
  }

  isExecuting(): boolean {
    return this.executionContext?.getStore()?.active ?? false;
  }

  getMetrics(): BusMetrics {
    return { ...this.metrics };
  }

  setConcurrency(limit?: number, maxQueueSize = 1000): void {
    if (limit !== undefined && !this.executionContext) {
      throw new Error("Finite bus concurrency requires an executionContext adapter for nested-dispatch safety");
    }
    this.limit = limit ?? Infinity;
    this.maxQueueSize = maxQueueSize;
    this.pump();
  }

  private pump(): void {
    while (this.active < this.limit && this.queue.length > 0) {
      this.active++;
      this.queue.shift()!.start();
    }
    if (this.active === 0 && this.queue.length === 0) {
      for (const resolve of this.drainWaiters) resolve();
      this.drainWaiters.clear();
    }
  }

  drain(): Promise<void> {
    if (this.isExecuting()) return Promise.reject(new Error("Cannot drain a bus from its own execution"));
    if (this.active === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise(resolve => this.drainWaiters.add(resolve));
  }

  close(options: BusCloseOptions = {}): Promise<void> {
    if (this.isExecuting()) return Promise.reject(new Error("Cannot close a bus from its own execution"));
    this.closing = true;
    if (options.drainQueued === false) {
      for (const entry of this.queue.splice(0)) entry.reject(new Error("Bus closed before queued dispatch started"));
    }
    this.pump();
    return this.drain();
  }

  async waitFor<T>(task: Promise<T>, config: BusRuntimeConfig, signal?: AbortSignal): Promise<T> {
    const frame = this.executionContext?.getStore();
    if (frame?.active) {
      frame.root.pending++;
      const release = () => {
        if (--frame.root.pending === 0) frame.root.release();
      };
      task.then(release, release);
    }
    const signals = [signal, frame?.active ? frame.signal : undefined].filter(
      (value): value is AbortSignal => value !== undefined,
    );
    const timeout = frame?.active ? config.nestedTimeout ?? 30_000 : config.queueTimeout ?? 30_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const removers: Array<() => void> = [];
    try {
      const cancellation = new Promise<never>((_, reject) => {
        for (const current of signals) {
          if (current.aborted) { reject(current.reason); return; }
          const abort = () => reject(current.reason);
          current.addEventListener("abort", abort, { once: true });
          removers.push(() => current.removeEventListener("abort", abort));
        }
        if (timeout > 0) timer = setTimeout(
          () => reject(new DOMException("Bus dependency wait timed out", "TimeoutError")), timeout,
        );
      });
      return await Promise.race([task, cancellation]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      removers.forEach(remove => remove());
    }
  }

  async run<T>(type: string, config: BusRuntimeConfig, operation: (signal: AbortSignal) => Promise<T>,
    options: BusDispatchOptions = {}): Promise<T> {
    const inherited = this.executionContext?.getStore();
    const parent = inherited?.active ? inherited : undefined;
    parent?.signal.throwIfAborted();
    options.signal?.throwIfAborted();
    if (this.closing && !parent) throw new Error("Bus is closed to new dispatches");
    if (!parent) {
      await new Promise<void>((resolve, reject) => {
        const signal = options.signal;
        let queueTimer: ReturnType<typeof setTimeout> | undefined;
        const cleanup = () => {
          signal?.removeEventListener("abort", abort);
          if (queueTimer !== undefined) clearTimeout(queueTimer);
        };
        const entry = {
          start: () => { cleanup(); resolve(); },
          reject: (error: Error) => { cleanup(); reject(error); },
        };
        const abort = () => {
          const index = this.queue.indexOf(entry);
          if (index >= 0) this.queue.splice(index, 1);
          cleanup();
          reject(signal!.reason);
          this.pump();
        };
        if (this.active >= this.limit && this.queue.length >= this.maxQueueSize) {
          reject(new Error("Bus dispatch queue capacity exceeded"));
          return;
        }
        signal?.addEventListener("abort", abort, { once: true });
        this.queue.push(entry);
        queueTimer = setTimeout(() => {
          const index = this.queue.indexOf(entry);
          if (index >= 0) this.queue.splice(index, 1);
          entry.reject(new DOMException("Bus admission wait timed out", "TimeoutError"));
          this.pump();
        }, config.queueTimeout ?? 30_000);
        this.pump();
      });
    }
    const start = Date.now();
    const controller = new AbortController();
    const root = parent?.root ?? {
      pending: 0,
      release: () => { this.active--; this.pump(); },
    };
    root.pending++;
    const frame: ExecutionFrame = { active: true, signal: controller.signal, root };
    const onParentAbort = () => controller.abort(parent!.signal.reason);
    if (parent) {
      parent.signal.addEventListener("abort", onParentAbort, { once: true });
      if (parent.signal.aborted) onParentAbort();
    }
    const onCallerAbort = () => controller.abort(options.signal!.reason);
    options.signal?.addEventListener("abort", onCallerAbort, { once: true });
    if (options.signal?.aborted) onCallerAbort();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      frame.active = false;
      parent?.signal.removeEventListener("abort", onParentAbort);
      if (--root.pending === 0) root.release();
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let removeAbortListener = () => {};
    let task: Promise<T> | undefined;

    try {
      if (config.enableMetrics) this.metrics.dispatched++;
      if (config.enableLogging) this.logger.info("Bus dispatch started", { type });

      task = Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return this.executionContext
          ? this.executionContext.run(frame, () => operation(controller.signal))
          : operation(controller.signal);
      });
      // A timeout cannot stop an uncooperative handler, so keep its slot until it really settles.
      task.then(release, release);

      const configured = config.timeout ?? 0;
      const timeout = parent ? Math.min(configured || Infinity, config.nestedTimeout ?? 30_000) : configured;
      const cancellation = new Promise<never>((_, reject) => {
        const onAbort = () => reject(controller.signal.reason);
        controller.signal.addEventListener("abort", onAbort, { once: true });
        removeAbortListener = () => controller.signal.removeEventListener("abort", onAbort);
        if (controller.signal.aborted) onAbort();
        if (timeout > 0) {
          timer = setTimeout(() => controller.abort(
            new DOMException(`Bus dispatch timed out after ${timeout}ms`, "TimeoutError"),
          ), timeout);
        }
      });
      const result = await Promise.race([task, cancellation]);
      if (config.enableLogging) this.logger.info("Bus dispatch completed", { type, durationMs: Date.now() - start });
      if (config.enableMetrics) this.metrics.succeeded++;
      return result;
    } catch (error) {
      if (!task) {
        release();
      }
      if (config.enableMetrics) this.metrics.failed++;
      if (config.enableLogging) {
        this.logger.error("Bus dispatch failed", { type, durationMs: Date.now() - start },
          error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      options.signal?.removeEventListener("abort", onCallerAbort);
      removeAbortListener();
      if (config.enableMetrics) this.metrics.totalDurationMs += Date.now() - start;
    }
  }
}
