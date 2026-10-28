import { DomainEvent, DomainEventRegistry } from "../../domain-events";
import { InMemoryEventStore } from "./in-memory-event-store";
import { EventStore } from "../event-store";
import { EventSubscriber } from "../event-subscriber";
import { EventBus, EventBusConfig, EventBusContext, EventBusMiddleware } from "..";
import { DeadLetterStore } from "../dead-letter-store";
import {
  BusRuntime,
  CrossDispatchCycleError,
  collectUpstreamWaiters,
  findDependencyPath,
  registerInFlightTask,
  validateBusConfig,
} from "../../cqrs/bus-runtime";
import type { BusDispatchOptions, BusCloseOptions } from "../../cqrs/bus-runtime";
import type { Logger } from "../../logger";
import type { ExecutionContext, ExecutionContextStorage } from "../../types/execution-context";
import { cloneValue } from "../../utils/object";

interface DeliveryFrame {
  active: boolean;
  eventIds: ReadonlySet<string>;
}

interface SharedEventDelivery {
  promise: Promise<void>;
  controller: AbortController;
  waiters: Set<symbol>;
}

export class InMemoryEventBus implements EventBus {
  private readonly subscribers = new Map<string, EventSubscriber<any>[]>();
  private readonly middlewares: EventBusMiddleware[] = [];
  private readonly store: EventStore;
  private readonly deadLetterStore: DeadLetterStore | undefined;
  private config: EventBusConfig;
  private readonly runtime: BusRuntime;
  private readonly inProgress = new Map<string, SharedEventDelivery>();
  private replayTask: Promise<void> | undefined;
  private readonly deliveryContext: ExecutionContextStorage<DeliveryFrame> | undefined;

  constructor(
    store: EventStore = new InMemoryEventStore(),
    config: EventBusConfig = {},
    deadLetterStore?: DeadLetterStore,
    logger?: Logger,
    executionContext?: ExecutionContext,
  ) {
    this.store = store;
    this.deadLetterStore = deadLetterStore;
    this.runtime = new BusRuntime(logger, executionContext);
    this.deliveryContext = executionContext?.createStorage<DeliveryFrame>();
    this.config = {
      enableLogging: false,
      enableMetrics: false,
      autoReplay: false,
      maxRetries: 3,
      ...config,
    };
    this.validateConfig(this.config);
    this.runtime.setConcurrency(this.config.maxConcurrency, this.config.maxQueueSize);
  }

  getMetrics() {
    return this.runtime.getMetrics();
  }
  drain(): Promise<void> { return this.runtime.drain(); }
  close(options?: BusCloseOptions): Promise<void> { return this.runtime.close(options); }

  ready(): Promise<void> {
    return this.ensureReady();
  }

  private ensureReady(signal?: AbortSignal): Promise<void> {
    if (this.runtime.isInReplay() || this.deliveryContext?.getStore()?.active) {
      return Promise.resolve();
    }
    if (!this.config.autoReplay) return Promise.resolve();
    this.replayTask ??= this.replay().catch(error => {
      this.replayTask = undefined;
      throw error;
    });
    return this.runtime.waitFor(this.replayTask, this.config, signal);
  }

  private validateConfig(config: EventBusConfig): void {
    validateBusConfig(config);
    if (config.autoReplay && !this.deliveryContext) {
      throw new Error("autoReplay requires an executionContext adapter for reentrant publication");
    }
    if (config.maxRetries !== undefined && (!Number.isSafeInteger(config.maxRetries) || config.maxRetries < 0)) {
      throw new RangeError("maxRetries must be a non-negative safe integer");
    }
  }

  subscribe<Event extends DomainEvent>(eventName: string, subscriber: EventSubscriber<Event>) {
    const name = subscriber.getName();
    if (!name || this.subscribers.get(eventName)?.some(existing => existing.getName() === name)) {
      throw new Error(`Subscriber names must be non-empty and unique for event '${eventName}'`);
    }
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }

    this.subscribers.get(eventName)!.push(subscriber);
  }

  unsubscribe<Event extends DomainEvent>(eventName: string, subscriber: EventSubscriber<Event>): boolean {
    const subs = this.subscribers.get(eventName);

    if (!subs) return false;

    const index = subs.indexOf(subscriber);

    if (index === -1) return false;

    subs.splice(index, 1);

    if (subs.length === 0) {
      this.subscribers.delete(eventName);
    }

    return true;
  }

  hasSubscribers(eventName: string): boolean {
    return (this.subscribers.get(eventName)?.length ?? 0) > 0;
  }

  getSubscribedEvents(): string[] {
    return Array.from(this.subscribers.keys()).filter(key => this.hasSubscribers(key));
  }

  clear(): void {
    this.subscribers.clear();
    this.middlewares.length = 0;
  }

  async publish<Event extends DomainEvent>(event: Event, options?: BusDispatchOptions) {
    options?.signal?.throwIfAborted();
    await this.ensureReady(options?.signal);
    return this.deliver(event, true, options);
  }

  private async deliver(event: DomainEvent, save: boolean, options?: BusDispatchOptions): Promise<void> {
    const parent = this.deliveryContext?.getStore();
    const label = `event:${event.getEventName()}`;
    const cycleMessage = `Recursive publication of event '${event.id}' would wait on its own delivery`;

    if (parent?.active && parent.eventIds.has(event.id)) {
      throw new CrossDispatchCycleError([label, label], cycleMessage);
    }

    const currentNode = this.runtime.getCurrentNode();
    if (currentNode) {
      for (const upstream of collectUpstreamWaiters(currentNode)) {
        if (upstream.active && upstream.eventIds.has(event.id)) {
          const path = findDependencyPath(upstream, currentNode) ?? [upstream.label, currentNode.label];
          throw new CrossDispatchCycleError([...path, label], cycleMessage);
        }
      }
    }

    const callerSignal = options?.signal;
    callerSignal?.throwIfAborted();
    const waiterId = Symbol(event.id);
    const ongoing = this.inProgress.get(event.id);

    if (ongoing) {
      ongoing.waiters.add(waiterId);
      const onFollowerAbort = () => {
        ongoing.waiters.delete(waiterId);
        if (ongoing.waiters.size === 0) {
          ongoing.controller.abort(callerSignal!.reason);
        }
      };
      callerSignal?.addEventListener("abort", onFollowerAbort, { once: true });
      try {
        return await this.runtime.waitFor(ongoing.promise, this.config, callerSignal, cycleMessage);
      } finally {
        ongoing.waiters.delete(waiterId);
        callerSignal?.removeEventListener("abort", onFollowerAbort);
      }
    }

    const config = this.getConfig();
    const frame: DeliveryFrame = {
      active: true,
      eventIds: new Set([...(parent?.active ? parent.eventIds : []), event.id]),
    };
    const deliveryController = new AbortController();
    const waiters = new Set<symbol>([waiterId]);
    const onLeaderAbort = () => {
      waiters.delete(waiterId);
      if (waiters.size === 0) {
        deliveryController.abort(callerSignal!.reason);
      }
    };
    callerSignal?.addEventListener("abort", onLeaderAbort, { once: true });

    let started = false;
    const operation = async (signal: AbortSignal) => {
      started = true;
      const activeNode = this.runtime.getCurrentNode();
      if (activeNode) {
        registerInFlightTask(execution, activeNode);
      }
      const context = this.createContext(event, config);
      context.signal = signal;

      try {
        signal.throwIfAborted();
        await this.applyMiddlewares("beforePublish", event, context);
        signal.throwIfAborted();
        if (save) await this.store.save(event.toPrimitives());
        await this.dispatch(event, config, signal);
        await this.applyMiddlewares("afterPublish", event, context);
      } catch (error) {
        await this.applyMiddlewares("onError", event, context,
          error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        frame.active = false;
        this.inProgress.delete(event.id);
      }
    };

    const execution = this.runtime.run(
      event.getEventName(),
      config,
      signal => this.deliveryContext
        ? this.deliveryContext.run(frame, () => operation(signal))
        : operation(signal),
      {
        signal: deliveryController.signal,
        label,
        eventId: event.id,
        dispatchKey: `event:${event.id}`,
        cycleMessage,
      },
    ).finally(() => {
      if (!started) {
        frame.active = false;
        this.inProgress.delete(event.id);
      }
    });

    registerInFlightTask(execution, currentNode);
    this.inProgress.set(event.id, {
      promise: execution,
      controller: deliveryController,
      waiters,
    });

    try {
      if (!callerSignal) {
        return await execution;
      }
      const callerAbortPromise = new Promise<never>((_, reject) => {
        if (callerSignal.aborted) {
          reject(callerSignal.reason);
          return;
        }
        callerSignal.addEventListener("abort", () => reject(callerSignal.reason), { once: true });
      });
      return await Promise.race([execution, callerAbortPromise]);
    } finally {
      waiters.delete(waiterId);
      callerSignal?.removeEventListener("abort", onLeaderAbort);
    }
  }

  async publishMany<Event extends DomainEvent>(events: readonly Event[], options?: BusDispatchOptions) {
    for (const event of events) {
      await this.publish(event, options);
    }
  }

  use(middleware: EventBusMiddleware): void {
    this.middlewares.push(middleware);
  }

  removeMiddleware(middleware: EventBusMiddleware): boolean {
    const index = this.middlewares.indexOf(middleware);
    if (index >= 0) {
      this.middlewares.splice(index, 1);
      return true;
    }
    return false;
  }

  private createContext(event: DomainEvent, config: EventBusConfig): EventBusContext {
    return {
      correlationId: event.getMetadata().correlationId,
      startTime: new Date(),
      metadata: {},
      config,
    };
  }

  private async applyMiddlewares(
    hook: keyof EventBusMiddleware,
    event: DomainEvent,
    context: EventBusContext,
    error?: Error
  ) {
    for (const middleware of this.middlewares) {
      if (hook === "onError") {
        if (error) await middleware.onError?.(event, error, context);
      } else {
        await middleware[hook]?.(event, context);
      }
    }
  }

  private async dispatch(event: DomainEvent, config: EventBusConfig, signal: AbortSignal): Promise<void> {
    if (await this.store.isProcessed(event.id)) return;

    const subscribers = [...(this.subscribers.get(event.getEventName()) ?? [])]
      .sort((a, b) => (b.getOptions?.().priority ?? 0) - (a.getOptions?.().priority ?? 0));
    if (subscribers.length === 0) return;
    let retainForReplay = false;

    const results = await Promise.allSettled(subscribers.map(async subscriber => {
      const subscriberId = subscriber.getName();
      if (await this.store.isAcknowledged(event.id, subscriberId)) return;
      const options = subscriber.getOptions?.() ?? {};
      const maxRetries = options.retryOnError === false ? 0 : options.maxRetries ?? config.maxRetries ?? 0;
      this.validateConfig({ maxRetries });
      let currentEvent = this.hydrateSubscriberEvent(event);

      for (let attempt = 0; ; attempt++) {
        try {
          signal.throwIfAborted();
          await subscriber.handle(currentEvent, { signal, subscriptionTime: new Date(), metadata: {}, options });
        } catch (error) {
          if (signal.aborted) {
            retainForReplay = true;
            throw error;
          }
          if (attempt < maxRetries) {
            currentEvent = this.hydrateSubscriberEvent(event, attempt + 1);
            continue;
          }
          if (this.deadLetterStore) {
            try {
              await this.deadLetterStore.add(currentEvent.toPrimitives(),
                error instanceof Error ? error.message : String(error), subscriber);
              await this.store.acknowledge(event.id, subscriberId);
            } catch (storageError) {
              retainForReplay = true;
              throw new AggregateError([error, storageError], "Subscriber failure could not be dead-lettered");
            }
          } else {
            retainForReplay = true;
          }
          throw error;
        }
        await this.store.acknowledge(event.id, subscriberId);
        return;
      }
    }));

    const failures = results.filter(result => result.status === "rejected");
    // Storage or hydration failures must never cause unacknowledged delivery to be discarded.
    const acknowledged = await Promise.all(subscribers.map(sub => this.store.isAcknowledged(event.id, sub.getName())));
    if (failures.length === 0 || (!retainForReplay && acknowledged.every(Boolean))) {
      await this.store.delete(event.id);
    }
    if (failures.length === 1) throw failures[0]!.reason;
    if (failures.length > 1) {
      throw new AggregateError(failures.map(result => result.reason), "Multiple event subscribers failed");
    }
  }

  private hydrateSubscriberEvent(event: DomainEvent, retries?: number): DomainEvent {
    const basePrimitives = cloneValue(event.toPrimitives());
    const primitives =
      retries !== undefined
        ? {
            ...basePrimitives,
            meta: {
              ...basePrimitives.meta,
              retries,
            },
          }
        : basePrimitives;

    if (DomainEventRegistry.has(primitives.type)) {
      return DomainEventRegistry.fromPrimitives(primitives);
    }

    const ctorFromPrimitives = (
      event.constructor as { fromPrimitives?: (p: any) => DomainEvent }
    )?.fromPrimitives;
    if (typeof ctorFromPrimitives === "function") {
      return ctorFromPrimitives.call(event.constructor, primitives);
    }

    return cloneValue(event);
  }

  async replay() {
    return this.runtime.trackOperation(async () => {
      const events = await this.store.all();

      for (const primitives of events) {
        const event = DomainEventRegistry.fromPrimitives(primitives);

        await this.deliver(event, false);
      }
    }, { isReplay: true });
  }

  getConfig(): EventBusConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<EventBusConfig>): void {
    const next = { ...this.config, ...config };
    this.validateConfig(next);
    this.runtime.setConcurrency(next.maxConcurrency, next.maxQueueSize);
    if (next.autoReplay && !this.config.autoReplay) this.replayTask = undefined;
    this.config = next;
  }
}
