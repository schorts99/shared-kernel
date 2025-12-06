import { DomainEventPrimitives } from "../../../domain-events";
import { EventStore } from "../../event-store";

export class AsyncInMemoryEventStore implements EventStore<true> {
  private readonly events: DomainEventPrimitives[] = [];

  async save(primitives: DomainEventPrimitives) {
    this.events.push(primitives);
  }

  async all() {
    return [...this.events];
  }

  async delete(id: string) {
    const index = this.events.findIndex(e => e.id === id);

    if (index !== -1) this.events.splice(index, 1);
  }

  async requeue(primitives: DomainEventPrimitives) {
    this.events.push(primitives);
  }

  async clear() {
    this.events.length = 0;
  }
}
