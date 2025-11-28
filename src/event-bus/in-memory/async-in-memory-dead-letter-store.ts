import { DeadLetterStore } from "../dead-letter-store";
import { DomainEventPrimitives } from "../../domain-events";

export class AsyncInMemoryDeadLetterStore implements DeadLetterStore<true> {
  private readonly failed: Array<{ primitives: DomainEventPrimitives; reason: string }> = [];

  async add(primitives: DomainEventPrimitives, reason: string): Promise<void> {
    this.failed.push({ primitives, reason });
  }

  async all() {
    return [...this.failed];
  }

  async clear() {
    this.failed.length = 0;
  }
}
