import { DomainEventPrimitives } from "../../domain-events";
import { EventStore } from "../event-store";

export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, DomainEventPrimitives>();
  private readonly processedEventIds = new Set<string>();

  async save(primitives: DomainEventPrimitives) {
    if (!this.processedEventIds.has(primitives.id)) {
      this.events.set(primitives.id, primitives);
    }
  }

  async all() {
    return [...this.events.values()];
  }

  async delete(id: string) {
    this.events.delete(id);
    this.processedEventIds.add(id);
  }

  async requeue(primitives: DomainEventPrimitives) {
    await this.save(primitives);
  }

  async clear() {
    this.events.clear();
    this.processedEventIds.clear();
  }

  async isProcessed(id: string): Promise<boolean> {
    return this.processedEventIds.has(id);
  }
}
