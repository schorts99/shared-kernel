import { DeadLetterStore } from "../dead-letter-store";
import { DomainEventPrimitives } from "../../domain-events";
import { EventSubscriber } from "../event-subscriber";

export class InMemoryDeadLetterStore implements DeadLetterStore {
  private readonly failed: Array<{ primitives: DomainEventPrimitives; reason: string; subscriber?: EventSubscriber<any> }> = [];

  async add(primitives: DomainEventPrimitives, reason: string, subscriber?: EventSubscriber<any>): Promise<void> {
    const item: { primitives: DomainEventPrimitives; reason: string; subscriber?: EventSubscriber<any> } = { primitives, reason };

    if (subscriber) {
      item.subscriber = subscriber;
    }

    this.failed.push(item);
  }

  async all() {
    return [...this.failed];
  }

  async clear() {
    this.failed.length = 0;
  }
}
