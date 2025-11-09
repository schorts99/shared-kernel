import { DeadLetterStore } from "../dead-letter-store";
import { DomainEventPrimitives } from "../../domain-events";

export class InMemoryDeadLetterStore implements DeadLetterStore {
  private readonly failed: Array<{ primitives: DomainEventPrimitives; reason: string }> = [];

  add(primitives: DomainEventPrimitives, reason: string): void {
    this.failed.push({ primitives, reason });
  }

  all(): Array<{ primitives: DomainEventPrimitives; reason: string }> {
    return [...this.failed];
  }

  clear(): void {
    this.failed.length = 0;
  }
}
