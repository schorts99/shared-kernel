import { DomainEvent, DomainEventRegistry } from "../../../domain-events";
import { SyncInMemoryEventStore } from "./sync-in-memory-event-store";
import { EventStore } from "../../event-store";
import { EventSubscriber } from "../../event-subscriber";
import { EventBus } from "../../index";
import { DeadLetterStore } from "../../dead-letter-store";

export class SyncInMemoryEventBus implements EventBus {
  private readonly subscribers = new Map<string, EventSubscriber[]>();
  private readonly store: EventStore;
  private readonly maxRetries: number;
  private readonly deadLetterStore: DeadLetterStore | undefined;

  constructor(
    store: EventStore = new SyncInMemoryEventStore(),
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

  publish<Event extends DomainEvent>(event: Event) {
    const primitives = event.toPrimitives();

    this.store.save(primitives);

    this.dispatch(event);
  }

  private dispatch(event: DomainEvent) {
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
        sub.handle(event);
      } catch (err) {
        event.requeue?.(err as Error);
      }
    }
  }

  replay() {
    const events = this.store.all();

    for (const primitives of events) {
      const event = DomainEventRegistry.create(primitives);

      this.dispatch(event);
    }
  }
}
