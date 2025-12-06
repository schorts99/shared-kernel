import { DomainEvent, DomainEventRegistry } from "../../../domain-events";
import { AsyncInMemoryEventStore } from "./async-in-memory-event-store";
import { EventStore } from "../../event-store";
import { EventSubscriber } from "../../event-subscriber";
import { EventBus } from "../../event-bus";
import { DeadLetterStore } from "../../dead-letter-store";

export class AsyncInMemoryEventBus implements EventBus<true> {
  private readonly subscribers = new Map<string, EventSubscriber[]>();
  private readonly store: EventStore<true>;
  private readonly maxRetries: number;
  private readonly deadLetterStore: DeadLetterStore | undefined;

  constructor(
    store: EventStore<true> = new AsyncInMemoryEventStore(),
    maxRetries = 3,
    deadLetterStore?: DeadLetterStore,
  ) {
    this.store = store;
    this.maxRetries = maxRetries;
    this.deadLetterStore = deadLetterStore;
  }

  subscribe<Event extends DomainEvent>(eventName: string, subscriber: EventSubscriber<Event>) {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }

    this.subscribers.get(eventName)!.push(subscriber);
  }

  async publish<Event extends DomainEvent>(event: Event) {
    const primitives = event.toPrimitives();

    this.store.save(primitives);

    await this.dispatch(event);
  }

  private async dispatch(event: DomainEvent) {
    const eventName = event.getEventName();
    const subs = this.subscribers.get(eventName) ?? [];
    const primitives = event.toPrimitives();

    event.ack = () => this.store.delete(event.id);
    event.requeue = (error?: Error) => {
      event.ack?.();

      if (event.meta.retries < this.maxRetries) {
        const updatedPrimitives = {
          ...primitives,
          meta: { ...primitives.meta, retries: event.meta.retries + 1 },
        };

        this.store.requeue(updatedPrimitives);
        this.publish(DomainEventRegistry.create(updatedPrimitives));
      } else if (this.deadLetterStore) {
        const reason = error ? error.message : `Exceeded max retries (${this.maxRetries})`;

        this.deadLetterStore.add(primitives, reason);
      }
    };

    for (const sub of subs) {
      try {
        await sub.handle(event);
      } catch (err) {
        event.requeue?.(err as Error);
      }
    }
  }

  async replay() {
    const events = await this.store.all();

    for (const primitives of events) {
      const event = DomainEventRegistry.create(primitives);

      await this.dispatch(event);
    }
  }
}
