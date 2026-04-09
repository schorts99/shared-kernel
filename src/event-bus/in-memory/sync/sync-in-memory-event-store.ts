import { DomainEventPrimitives } from "../../../domain-events";
import { EventStore } from "../../event-store";

export class SyncInMemoryEventStore implements EventStore {
  private readonly events: DomainEventPrimitives[] = [];
  private readonly processedEventIds = new Set<string>();

  save(primitives: DomainEventPrimitives) {
    this.events.push(primitives);
    this.processedEventIds.add(primitives.id);
  }

  all() {
    return [...this.events];
  }

  delete(id: string) {
    const index = this.events.findIndex(e => e.id === id);

    if (index !== -1) this.events.splice(index, 1);
  }

  requeue(primitives: DomainEventPrimitives) {
    this.events.push(primitives);
  }

  clear() {
    this.events.length = 0;
    this.processedEventIds.clear();
  }

  isProcessed(id: string): boolean {
    return this.processedEventIds.has(id);
  }
}
