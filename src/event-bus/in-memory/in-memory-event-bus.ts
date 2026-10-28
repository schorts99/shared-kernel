import { DomainEvent, DomainEventRegistry } from "../../domain-events";
import { InMemoryEventStore } from "./in-memory-event-store";
import { EventStore } from "../event-store";
import { EventSubscriber } from "../event-subscriber";
import { EventBus, EventBusConfig, EventBusContext, EventBusMiddleware } from "..";
import { DeadLetterStore } from "../dead-letter-store";
import { BusRuntime } from "../../cqrs/bus-runtime";
import type { Logger } from "../../logger";

export class InMemoryEventBus implements EventBus {
  private readonly subscribers = new Map<string, EventSubscriber<any>[]>();
  private readonly middlewares: EventBusMiddleware[] = [];
  private readonly store: EventStore;
  private readonly deadLetterStore: DeadLetterStore | undefined;
  private config: EventBusConfig;
  private readonly runtime: BusRuntime;
  private readonly inProgress = new Map<string, Promise<void>>();
  private replayTask: Promise<void> | undefined;

  constructor(
    store: EventStore = new InMemoryEventStore(),
    config: EventBusConfig = {},
    deadLetterStore?: DeadLetterStore,
    logger?: Logger,
  ) {
    this.store = store;
    this.deadLetterStore = deadLetterStore;
    this.runtime = new BusRuntime(logger);
    this.config = {
      enableLogging: false,
      enableMetrics: false,
      autoReplay: false,
      maxRetries: 3,
      ...config,
    };
    this.validateConfig(this.config);
  }

  getMetrics() {
    return this.runtime.getMetrics();
  }

  ready(): Promise<void> {
    if (!this.config.autoReplay) return Promise.resolve();
    this.replayTask ??= this.replay().catch(error => {
      this.replayTask = undefined;
      throw error;
    });
    return this.replayTask;
  }

  private validateConfig(config: EventBusConfig): void {
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

    return true;
  }

  async publish<Event extends DomainEvent>(event: Event) {
    await this.ready();
    return this.deliver(event, true);
  }

  private async deliver(event: DomainEvent, save: boolean): Promise<void> {
    const ongoing = this.inProgress.get(event.id);
    if (ongoing) return ongoing;
    const config = this.getConfig();
    const execution = this.runtime.run(event.getEventName(), config, async () => {
      const context = this.createContext(event, config);

      try {
        await this.applyMiddlewares("beforePublish", event, context);
        if (save) await this.store.save(event.toPrimitives());
        await this.dispatch(event, config);
        await this.applyMiddlewares("afterPublish", event, context);
      } catch (error) {
        await this.applyMiddlewares("onError", event, context,
          error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }).finally(() => {
      this.inProgress.delete(event.id);
    });
    this.inProgress.set(event.id, execution);
    return execution;
  }

  async publishMany<Event extends DomainEvent>(events: readonly Event[]) {
    for (const event of events) {
      await this.publish(event);
    }
  }

  use(middleware: EventBusMiddleware): void {
    this.middlewares.push(middleware);
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

  private async dispatch(event: DomainEvent, config: EventBusConfig): Promise<void> {
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
      let currentEvent = event;

      for (let attempt = 0; ; attempt++) {
        try {
          await subscriber.handle(currentEvent, { subscriptionTime: new Date(), metadata: {}, options });
        } catch (error) {
          if (attempt < maxRetries) {
            const primitives = event.toPrimitives();
            currentEvent = DomainEventRegistry.fromPrimitives({
              ...primitives,
              meta: { ...primitives.meta, retries: attempt + 1 },
            });
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

  async replay() {
    const events = await this.store.all();

    for (const primitives of events) {
      const event = DomainEventRegistry.fromPrimitives(primitives);

      await this.deliver(event, false);
    }
  }

  getConfig(): EventBusConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<EventBusConfig>): void {
    const next = { ...this.config, ...config };
    this.validateConfig(next);
    if (next.autoReplay && !this.config.autoReplay) this.replayTask = undefined;
    this.config = next;
  }
}
