import { DeadLetterStore } from "../dead-letter-store.js";
import { DomainEventPrimitives } from "../../domain-events/index.js";
import { EventSubscriber } from "../event-subscriber.js";
import { cloneValue } from "../../utils/object.js";

export class InMemoryDeadLetterStore implements DeadLetterStore {
  private readonly failed: Array<{ primitives: DomainEventPrimitives; reason: string; subscriber?: EventSubscriber<any> }> = [];

  async add(primitives: DomainEventPrimitives, reason: string, subscriber?: EventSubscriber<any>): Promise<void> {
    const item: { primitives: DomainEventPrimitives; reason: string; subscriber?: EventSubscriber<any> } = {
      primitives: cloneValue(primitives),
      reason,
    };

    if (subscriber) {
      item.subscriber = subscriber;
    }

    this.failed.push(item);
  }

  async all() {
    return this.failed.map(item => ({
      primitives: cloneValue(item.primitives),
      reason: item.reason,
      ...(item.subscriber ? { subscriber: item.subscriber } : {}),
    }));
  }

  async clear() {
    this.failed.length = 0;
  }
}
