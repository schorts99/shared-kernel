import { DomainEventPrimitives } from "../../domain-events";
import { EventStore } from "../event-store";

export class InMemoryEventStore implements EventStore {
  private readonly events: DomainEventPrimitives[] = [];
  private readonly processedEventIds = new Set<string>();

  async save(primitives: DomainEventPrimitives) {
    this.events.push(primitives);
  }

  async all() {
    return [...this.events];
  }

  async delete(id: string) {
    const index = this.events.findIndex(e => e.id === id);

    if (index !== -1) {
      this.events.splice(index, 1);
    }

    this.processedEventIds.add(id);
  }

  async requeue(primitives: DomainEventPrimitives) {
    this.events.push(primitives);
  }

  async clear() {
    this.events.length = 0;
    this.processedEventIds.clear();
  }

  async isProcessed(id: string): Promise<boolean> {
    return this.processedEventIds.has(id);
  }
}
