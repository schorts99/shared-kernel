import { DomainEventPrimitives } from "../../domain-events";
import { EventStore } from "../event-store";

export class AsyncInMemoryEventStore implements EventStore {
  private readonly events: DomainEventPrimitives[] = [];

  async save(primitives: DomainEventPrimitives): Promise<void> {
    this.events.push(primitives);
  }

  async all(): Promise<DomainEventPrimitives[]> {
    return [...this.events];
  }

  async delete(id: string): Promise<void> {
    const index = this.events.findIndex(e => e.id === id);

    if (index !== -1) this.events.splice(index, 1);
  }

  async requeue(primitives: DomainEventPrimitives): Promise<void> {
    this.events.push(primitives);
  }

  async clear(): Promise<void> {
    this.events.length = 0;
  }
}
