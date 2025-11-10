import { DomainEventPrimitives } from "../domain-events";

export interface DeadLetterStore {
  add(primitives: DomainEventPrimitives, reason: string): Promise<void>;
  all(): Promise<Array<{ primitives: DomainEventPrimitives; reason: string }>>;
  clear(): Promise<void>;
}
