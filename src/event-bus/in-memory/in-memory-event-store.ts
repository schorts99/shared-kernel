import { DomainEventPrimitives } from "../../domain-events";
import { EventStore } from "../event-store";

export class InMemoryEventStore implements EventStore {
  private readonly events: DomainEventPrimitives[] = [];

  save(primitives: DomainEventPrimitives): void {
    this.events.push(primitives);
  }

  all(): DomainEventPrimitives[] {
    return [...this.events];
  }

  delete(id: string): void {
    const index = this.events.findIndex(e => e.id === id);

    if (index !== -1) this.events.splice(index, 1);
  }

  requeue(primitives: DomainEventPrimitives): void {
    this.events.push(primitives);
  }

  clear(): void {
    this.events.length = 0;
  }
}
