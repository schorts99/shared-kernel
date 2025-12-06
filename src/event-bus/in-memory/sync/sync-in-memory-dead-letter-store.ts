import { DeadLetterStore } from "../../dead-letter-store";
import { DomainEventPrimitives } from "../../../domain-events";

export class SyncInMemoryDeadLetterStore implements DeadLetterStore {
  private readonly failed: Array<{ primitives: DomainEventPrimitives; reason: string }> = [];

  add(primitives: DomainEventPrimitives, reason: string) {
    this.failed.push({ primitives, reason });
  }

  all() {
    return [...this.failed];
  }

  clear() {
    this.failed.length = 0;
  }
}
