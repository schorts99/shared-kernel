import { ConsoleLogger } from "../logger/index.js";
import type { Logger } from "../logger/index.js";
import type { ExecutionContext, ExecutionContextStorage } from "../types/execution-context.js";

export class CrossDispatchCycleError extends Error {
  readonly cycle: readonly string[];

  constructor(cycle: readonly string[], message?: string) {
    super(message ?? `Cross-dispatch dependency cycle detected: ${cycle.join(" -> ")}`);
    this.name = "CrossDispatchCycleError";
    this.cycle = [...cycle];
  }
}

export interface BusSlotRoot {
  readonly bus: BusRuntime;
  readonly owner: ExecutionNode;
  pending: number;
  release: () => void;
}

export interface ExecutionNode {
  readonly id: symbol;
  readonly label: string;
  readonly dispatchKey?: string | undefined;
  readonly bus: BusRuntime;
  readonly parent?: ExecutionNode | undefined;
  active: boolean;
  signal: AbortSignal;
  readonly rootsByBus: Map<BusRuntime, BusSlotRoot>;
  readonly waitingOn: Set<ExecutionNode>;
  readonly waitedBy: Set<ExecutionNode>;
  waitingOnBus?: BusRuntime | undefined;
  readonly idempotencyKeys: ReadonlyArray<{ store: unknown; key: string }>;
  readonly eventIds: ReadonlySet<string>;
  readonly replayBuses: ReadonlySet<unknown>;
}

const sharedStorageByContext = new WeakMap<ExecutionContext, ExecutionContextStorage<ExecutionNode>>();
const activeStorages = new Set<ExecutionContextStorage<ExecutionNode>>();
const taskOwnerByPromise = new WeakMap<object, ExecutionNode>();

export function getSharedExecutionStorage(
  executionContext?: ExecutionContext,
): ExecutionContextStorage<ExecutionNode> | undefined {
  if (!executionContext) return undefined;
  let storage = sharedStorageByContext.get(executionContext);
  if (!storage) {
    storage = executionContext.createStorage<ExecutionNode>();
    sharedStorageByContext.set(executionContext, storage);
    activeStorages.add(storage);
  }
  return storage;
}

export function getCurrentExecutionNode(
  storage?: ExecutionContextStorage<ExecutionNode>,
): ExecutionNode | undefined {
  if (storage) {
    const node = storage.getStore();
    return node?.active ? node : undefined;
  }
  for (const candidate of activeStorages) {
    const node = candidate.getStore();
    if (node?.active) return node;
  }
  return undefined;
}

export function registerInFlightTask<T extends object>(task: T, owner?: ExecutionNode): T {
  if (owner) {
    taskOwnerByPromise.set(task, owner);
  }
  return task;
}

export function getInFlightTaskOwner(task: object): ExecutionNode | undefined {
  return taskOwnerByPromise.get(task);
}

export function addWaitEdge(waiter: ExecutionNode, target: ExecutionNode): void {
  if (waiter === target) return;
  waiter.waitingOn.add(target);
  target.waitedBy.add(waiter);
}

export function removeWaitEdge(waiter: ExecutionNode, target: ExecutionNode): void {
  waiter.waitingOn.delete(target);
  target.waitedBy.delete(waiter);
}

export function findDependencyPath(
  from: ExecutionNode,
  target: ExecutionNode,
  visited = new Set<ExecutionNode>(),
  visitingBuses = new Set<BusRuntime>(),
): string[] | undefined {
  if (from === target) return [from.label];
  if (visited.has(from)) return undefined;
  visited.add(from);

  for (const next of from.waitingOn) {
    const subPath = findDependencyPath(next, target, visited, visitingBuses);
    if (subPath) return [from.label, ...subPath];
  }

  const queuedBus = from.waitingOnBus;
  if (queuedBus && !visitingBuses.has(queuedBus) && queuedBus.isAtCapacity()) {
    const owners = queuedBus.getActiveSlotOwners();
    if (owners.length > 0) {
      visitingBuses.add(queuedBus);
      try {
        let firstOwnerPath: string[] | undefined;
        let allOwnersBlockedOnTarget = true;
        for (const owner of owners) {
          const ownerPath = findDependencyPath(owner, target, new Set(visited), visitingBuses);
          if (!ownerPath) {
            allOwnersBlockedOnTarget = false;
            break;
          }
          firstOwnerPath ??= ownerPath;
        }
        if (allOwnersBlockedOnTarget && firstOwnerPath) {
          return [from.label, ...firstOwnerPath];
        }
      } finally {
        visitingBuses.delete(queuedBus);
      }
    }
  }

  return undefined;
}

export function collectUpstreamWaiters(
  target: ExecutionNode,
  visited = new Set<ExecutionNode>(),
): Set<ExecutionNode> {
  if (visited.has(target)) return visited;
  visited.add(target);
  if (target.parent) {
    collectUpstreamWaiters(target.parent, visited);
  }
  for (const waiter of target.waitedBy) {
    collectUpstreamWaiters(waiter, visited);
  }
  return visited;
}

export function assertNoCycleWhenWaitingOn(
  waiter: ExecutionNode,
  target: ExecutionNode,
  customMessage?: string,
): void {
  const path = findDependencyPath(target, waiter);
  if (path) {
    throw new CrossDispatchCycleError([waiter.label, ...path], customMessage);
  }
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
  signal?: AbortSignal | undefined;
}

export interface BusRunOptions extends BusDispatchOptions {
  dispatchKey?: string | undefined;
  label?: string | undefined;
  idempotencyKey?: { store: unknown; key: string } | undefined;
  eventId?: string | undefined;
  cycleMessage?: string | undefined;
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
  private activeOperations = 0;
  private readonly activeSlotOwners = new Set<ExecutionNode>();
  private readonly queue: Array<{ start: () => void; reject: (error: Error) => void }> = [];
  private limit = Infinity;
  private maxQueueSize = 1000;
  private closing = false;
  private readonly drainWaiters = new Set<() => void>();
  private readonly metrics: BusMetrics = { dispatched: 0, succeeded: 0, failed: 0, totalDurationMs: 0 };
  private readonly executionContext: ExecutionContextStorage<ExecutionNode> | undefined;

  constructor(private readonly logger: Logger = new ConsoleLogger(), executionContext?: ExecutionContext) {
    this.executionContext = getSharedExecutionStorage(executionContext);
  }

  getCurrentNode(): ExecutionNode | undefined {
    const node = this.executionContext?.getStore();
    return node?.active ? node : undefined;
  }

  hasExecutionContext(): boolean {
    return this.executionContext !== undefined;
  }

  isClosing(): boolean {
    return this.closing;
  }

  isAtCapacity(): boolean {
    return this.active >= this.limit;
  }

  getActiveSlotOwners(): ExecutionNode[] {
    return [...this.activeSlotOwners];
  }

  isExecuting(): boolean {
    const node = this.getCurrentNode();
    if (!node) return false;
    if (node.rootsByBus.has(this) || node.replayBuses.has(this)) return true;
    for (const owner of this.activeSlotOwners) {
      if (findDependencyPath(owner, node)) return true;
    }
    return false;
  }

  isInReplay(): boolean {
    return this.getCurrentNode()?.replayBuses.has(this) ?? false;
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
    if (this.active === 0 && this.activeOperations === 0 && this.queue.length === 0) {
      for (const resolve of this.drainWaiters) resolve();
      this.drainWaiters.clear();
    }
  }

  async trackOperation<T>(operation: () => Promise<T>, options: { isReplay?: boolean } = {}): Promise<T> {
    const parent = this.getCurrentNode();
    const isReentrant = parent ? (parent.rootsByBus.has(this) || parent.replayBuses.has(this)) : false;
    if (this.closing && !isReentrant) {
      throw new Error("Bus is closed to new dispatches");
    }
    this.activeOperations++;
    const controller = new AbortController();
    const node: ExecutionNode = {
      id: Symbol("bus-operation"),
      label: options.isReplay ? "event:replay" : "bus:operation",
      bus: this,
      parent,
      active: true,
      signal: controller.signal,
      rootsByBus: new Map(parent?.rootsByBus),
      waitingOn: new Set(),
      waitedBy: new Set(),
      idempotencyKeys: parent?.idempotencyKeys ?? [],
      eventIds: parent?.eventIds ?? new Set(),
      replayBuses: new Set([...(parent?.replayBuses ?? []), ...(options.isReplay ? [this] : [])]),
    };
    if (parent) addWaitEdge(parent, node);
    try {
      const task = Promise.resolve().then(() =>
        this.executionContext ? this.executionContext.run(node, operation) : operation(),
      );
      registerInFlightTask(task, node);
      return await task;
    } finally {
      node.active = false;
      if (parent) removeWaitEdge(parent, node);
      this.activeOperations--;
      this.pump();
    }
  }

  drain(): Promise<void> {
    if (this.isExecuting()) return Promise.reject(new Error("Cannot drain a bus from its own execution"));
    if (this.active === 0 && this.activeOperations === 0 && this.queue.length === 0) return Promise.resolve();
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

  async waitFor<T>(
    task: Promise<T>,
    config: BusRuntimeConfig,
    signal?: AbortSignal,
    customCycleMessage?: string,
  ): Promise<T> {
    const frame = this.getCurrentNode();
    const owner = getInFlightTaskOwner(task);

    if (frame && owner) {
      assertNoCycleWhenWaitingOn(frame, owner, customCycleMessage);
      addWaitEdge(frame, owner);
    }

    const trackSlot = frame && !owner;
    if (trackSlot) {
      for (const root of frame.rootsByBus.values()) {
        root.pending++;
      }
      const releaseSlot = () => {
        for (const root of frame.rootsByBus.values()) {
          if (--root.pending === 0) root.release();
        }
      };
      task.then(releaseSlot, releaseSlot);
    }

    const signals = [signal, frame?.signal].filter(
      (value): value is AbortSignal => value !== undefined,
    );
    const timeout = frame ? config.nestedTimeout ?? 30_000 : config.queueTimeout ?? 30_000;
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
      if (frame && owner) {
        removeWaitEdge(frame, owner);
      }
      if (timer !== undefined) clearTimeout(timer);
      removers.forEach(remove => remove());
    }
  }

  private checkUpstreamCycles(parent: ExecutionNode, label: string, options: BusRunOptions): void {
    const upstreamNodes = collectUpstreamWaiters(parent);

    if (options.idempotencyKey) {
      const { store, key } = options.idempotencyKey;
      for (const node of upstreamNodes) {
        if (node.active && node.idempotencyKeys.some(entry => entry.store === store && entry.key === key)) {
          const path = findDependencyPath(node, parent) ?? [node.label, parent.label];
          throw new CrossDispatchCycleError(
            [...path, label],
            `Recursive command dispatch for idempotency key '${key}'`,
          );
        }
      }
    }

    if (options.eventId) {
      const eventId = options.eventId;
      for (const node of upstreamNodes) {
        if (node.active && node.eventIds.has(eventId)) {
          const path = findDependencyPath(node, parent) ?? [node.label, parent.label];
          throw new CrossDispatchCycleError(
            [...path, label],
            `Recursive publication of event '${eventId}' would wait on its own delivery`,
          );
        }
      }
    }

    if (options.dispatchKey) {
      for (const node of upstreamNodes) {
        if (node.active && node.dispatchKey === options.dispatchKey) {
          const path = findDependencyPath(node, parent) ?? [node.label, parent.label];
          throw new CrossDispatchCycleError([...path, label], options.cycleMessage);
        }
      }
    }
  }

  async run<T>(
    type: string,
    config: BusRuntimeConfig,
    operation: (signal: AbortSignal) => Promise<T>,
    options: BusRunOptions = {},
  ): Promise<T> {
    const parent = this.getCurrentNode();
    parent?.signal.throwIfAborted();
    options.signal?.throwIfAborted();

    const label = options.label ?? type;
    if (parent) {
      this.checkUpstreamCycles(parent, label, options);
    }

    const existingBusRoot = parent?.rootsByBus.get(this);
    const inReplayOnThisBus = parent?.replayBuses.has(this) ?? false;
    const isReentrantOnThisBus = existingBusRoot !== undefined || inReplayOnThisBus;

    if (this.closing && !isReentrantOnThisBus) {
      throw new Error("Bus is closed to new dispatches");
    }

    if (!existingBusRoot) {
      if (parent && this.active >= this.limit && this.activeSlotOwners.size > 0) {
        let firstPath: string[] | undefined;
        let allOwnersBlockedOnParent = true;
        for (const owner of this.activeSlotOwners) {
          const path = findDependencyPath(owner, parent);
          if (!path) {
            allOwnersBlockedOnParent = false;
            break;
          }
          firstPath ??= path;
        }
        if (allOwnersBlockedOnParent && firstPath) {
          throw new CrossDispatchCycleError([parent.label, ...firstPath, label], options.cycleMessage);
        }
      }

      await new Promise<void>((resolve, reject) => {
        const signals = [options.signal, parent?.signal].filter(
          (value): value is AbortSignal => value !== undefined,
        );
        let queueTimer: ReturnType<typeof setTimeout> | undefined;
        const removers: Array<() => void> = [];
        const cleanup = () => {
          if (parent && parent.waitingOnBus === this) {
            parent.waitingOnBus = undefined;
          }
          removers.forEach(remove => remove());
          if (queueTimer !== undefined) clearTimeout(queueTimer);
        };
        const entry = {
          start: () => { cleanup(); resolve(); },
          reject: (error: Error) => { cleanup(); reject(error); },
        };
        if (this.active >= this.limit && this.queue.length >= this.maxQueueSize) {
          reject(new Error("Bus dispatch queue capacity exceeded"));
          return;
        }
        for (const sig of signals) {
          if (sig.aborted) {
            reject(sig.reason);
            return;
          }
          const abort = () => {
            const index = this.queue.indexOf(entry);
            if (index >= 0) this.queue.splice(index, 1);
            cleanup();
            reject(sig.reason);
            this.pump();
          };
          sig.addEventListener("abort", abort, { once: true });
          removers.push(() => sig.removeEventListener("abort", abort));
        }
        if (parent && this.active >= this.limit) {
          parent.waitingOnBus = this;
        }
        this.queue.push(entry);
        const admissionTimeout = parent
          ? Math.min(config.queueTimeout ?? 30_000, config.nestedTimeout ?? 30_000)
          : (config.queueTimeout ?? 30_000);
        queueTimer = setTimeout(() => {
          const index = this.queue.indexOf(entry);
          if (index >= 0) this.queue.splice(index, 1);
          entry.reject(new DOMException("Bus admission wait timed out", "TimeoutError"));
          this.pump();
        }, admissionTimeout);
        this.pump();
      });
    }

    const start = Date.now();
    const controller = new AbortController();
    const rootsByBus = new Map<BusRuntime, BusSlotRoot>(parent?.rootsByBus);

    const frame: ExecutionNode = {
      id: Symbol(label),
      label,
      dispatchKey: options.dispatchKey,
      bus: this,
      parent,
      active: true,
      signal: controller.signal,
      rootsByBus,
      waitingOn: new Set(),
      waitedBy: new Set(),
      idempotencyKeys: options.idempotencyKey
        ? [...(parent?.idempotencyKeys ?? []), options.idempotencyKey]
        : (parent?.idempotencyKeys ?? []),
      eventIds: options.eventId
        ? new Set([...(parent?.eventIds ?? []), options.eventId])
        : (parent?.eventIds ?? new Set()),
      replayBuses: parent?.replayBuses ?? new Set(),
    };

    if (!existingBusRoot) {
      const newRoot: BusSlotRoot = {
        bus: this,
        owner: frame,
        pending: 0,
        release: () => {
          this.activeSlotOwners.delete(frame);
          this.active--;
          this.pump();
        },
      };
      this.activeSlotOwners.add(frame);
      rootsByBus.set(this, newRoot);
    }

    for (const root of rootsByBus.values()) {
      root.pending++;
    }
    if (parent) {
      addWaitEdge(parent, frame);
    }

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
      if (parent) {
        removeWaitEdge(parent, frame);
        parent.signal.removeEventListener("abort", onParentAbort);
      }
      for (const root of rootsByBus.values()) {
        if (--root.pending === 0) root.release();
      }
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
      registerInFlightTask(task, frame);
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
