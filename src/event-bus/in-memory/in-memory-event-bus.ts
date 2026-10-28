import { DomainEvent, DomainEventRegistry } from "../../domain-events";
import { InMemoryEventStore } from "./in-memory-event-store";
import { EventStore } from "../event-store";
import { EventSubscriber, EventSubscriberContext } from "../event-subscriber";
import { EventBus, EventBusConfig, EventBusContext, EventBusMiddleware } from "..";
import { DeadLetterStore } from "../dead-letter-store";

export class InMemoryEventBus implements EventBus {
  private readonly subscribers = new Map<string, EventSubscriber<any>[]>();
  private readonly middlewares: EventBusMiddleware[] = [];
  private readonly store: EventStore;
  private readonly deadLetterStore: DeadLetterStore | undefined;
  private config: EventBusConfig;

  constructor(
    store: EventStore = new InMemoryEventStore(),
    config: EventBusConfig = {},
    deadLetterStore?: DeadLetterStore,
  ) {
    this.store = store;
    this.deadLetterStore = deadLetterStore;
    this.config = {
      enableLogging: false,
      enableMetrics: false,
      autoReplay: false,
      maxRetries: 3,
      ...config,
    };
  }

  subscribe<Event extends DomainEvent>(eventName: string, subscriber: EventSubscriber<Event>) {
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
    const context = this.createContext(event);

    try {
      await this.applyMiddlewares("beforePublish", event, context);
      await this.store.save(event.toPrimitives());
      await this.dispatch(event);
      await this.applyMiddlewares("afterPublish", event, context);
    } catch (error) {
      await this.applyMiddlewares("onError", event, context, error as Error);
      throw error;
    }
  }

  async publishMany<Event extends DomainEvent>(events: readonly Event[]) {
    for (const event of events) {
      await this.publish(event);
    }
  }

  use(middleware: EventBusMiddleware): void {
    this.middlewares.push(middleware);
  }

  private createContext(event: DomainEvent): EventBusContext {
    return {
      correlationId: event.getMetadata().correlationId,
      startTime: new Date(),
      metadata: {},
      config: this.config,
    };
  }

  private async applyMiddlewares(
    hook: keyof EventBusMiddleware,
    event: DomainEvent,
    context: EventBusContext,
    error?: Error
  ) {
    for (const middleware of this.middlewares) {
      const fn = middleware[hook];

      if (typeof fn === "function") {
        if (hook === "onError" && error) {
          await (fn as any)(event, error, context);
        } else {
          await (fn as any)(event, context);
        }
      }
    }
  }

	private async dispatch(event: DomainEvent) {
		const eventName = event.getEventName();
		const subs = this.subscribers.get(eventName) ?? [];
		const eventId = event.getMetadata().id;
		let retainForReplay = false;
		const deadLettered = new Set<EventSubscriber<any>>();

		if (await this.store.isProcessed(eventId)) {
			return;
		}

		const executeSubscriber = async (subscriber: EventSubscriber<any>, currentEvent: DomainEvent) => {
			const subscriberContext: EventSubscriberContext = {
				subscriptionTime: new Date(),
				metadata: {},
				options: subscriber.getOptions?.() ?? {},
			};

			await subscriber.handle(currentEvent, subscriberContext);
		};

		const retrySubscriber = async (
			failedEvent: DomainEvent,
			subscriber: EventSubscriber<any>,
			error?: Error,
		) => {
			const maxRetries = this.config.maxRetries ?? 0;
			const currentRetries = failedEvent.getMetadata().retries;

			if (currentRetries < maxRetries) {
				const updatedPrimitives = {
					...failedEvent.toPrimitives(),
					meta: { ...failedEvent.toPrimitives().meta, retries: currentRetries + 1 },
				};

				await this.store.requeue(updatedPrimitives);

				const retryEvent = DomainEventRegistry.fromPrimitives(updatedPrimitives);

				try {
					await executeSubscriber(subscriber, retryEvent);
				} catch (err) {
					await retrySubscriber(retryEvent, subscriber, err as Error);
				}
			} else if (this.deadLetterStore) {
				const reason = error ? error.message : `Exceeded max retries (${maxRetries})`;

				await this.deadLetterStore.add(failedEvent.toPrimitives(), reason, subscriber);
				deadLettered.add(subscriber);
				throw error ?? new Error(`Subscriber failed permanently: ${reason}`);
			} else {
				throw error || new Error("Subscriber failed");
			}
		};

		const subscriberPromises = subs.map(async sub => {
			try {
				await executeSubscriber(sub, event);
			} catch (error) {
				try {
					await retrySubscriber(event, sub, error instanceof Error ? error : new Error(String(error)));
				} catch (retryError) {
					if (!deadLettered.has(sub)) retainForReplay = true;
					throw retryError;
				}
			}
		});

		const results = await Promise.allSettled(subscriberPromises);
		const failures = results.filter(result => result.status === "rejected");

		if (failures.length === 0 || !retainForReplay) {
			await this.store.delete(eventId);
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

      await this.dispatch(event);
    }
  }

  getConfig(): EventBusConfig {
    return this.config;
  }

  setConfig(config: Partial<EventBusConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
