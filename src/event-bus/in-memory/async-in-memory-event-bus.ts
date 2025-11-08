import { DomainEvent, DomainEventRegistry } from "../../domain-events";
import { InMemoryEventStore } from "./in-memory-event-store";
import { EventStore } from "../event-store";
import { EventSubscriber } from "../event-subscriber";
import { EventBus } from "../event-bus";

export class AsyncInMemoryEventBus implements EventBus {
  private readonly subscribers = new Map<string, EventSubscriber[]>();
  private readonly store: EventStore;
  private readonly maxRetries: number;

  constructor(store: EventStore = new InMemoryEventStore(), maxRetries = 3) {
    this.store = store;
    this.maxRetries = maxRetries;
  }

  subscribe<Event extends DomainEvent>(eventName: string, subscriber: EventSubscriber<Event>): void {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }

    this.subscribers.get(eventName)!.push(subscriber);
  }

  async publish<Event extends DomainEvent>(event: Event): Promise<void> {
    const primitives = event.toPrimitives();

    this.store.save(primitives);

    await this.dispatch(event);
  }

  private async dispatch(event: DomainEvent): Promise<void> {
    const eventName = event.getEventName();
    const subs = this.subscribers.get(eventName) ?? [];
    const primitives = event.toPrimitives();

    event.ack = () => this.store.delete(event.id);
    event.requeue = () => {
      event.ack?.();

      if (event.meta.retries < this.maxRetries) {
        const updatedPrimitives = {
          ...primitives,
          meta: { ...primitives.meta, retries: event.meta.retries + 1 },
        };

        this.store.requeue(updatedPrimitives);
        this.publish(DomainEventRegistry.create(updatedPrimitives));
      } else {
        console.warn(`Event ${event.id} exceeded max retries (${this.maxRetries}). Dropping.`);
      }
    };

    for (const sub of subs) {
      await sub.handle(event);
    }
  }

  async replay(): Promise<void> {
    const events = this.store.all();

    for (const primitives of events) {
      const event = DomainEventRegistry.create(primitives);
      await this.dispatch(event);
    }
  }
}
