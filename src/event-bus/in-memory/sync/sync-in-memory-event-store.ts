import { DomainEventPrimitives } from "../../../domain-events";
import { EventStore } from "../../event-store";

export class SyncInMemoryEventStore implements EventStore {
  private readonly events: DomainEventPrimitives[] = [];

  save(primitives: DomainEventPrimitives) {
    this.events.push(primitives);
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
  }
}
