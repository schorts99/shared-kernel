import { DomainEventPrimitives } from "../domain-events/index.js";

export interface EventStore {
  save(primitives: DomainEventPrimitives): Promise<void>;
  all(): Promise<DomainEventPrimitives[]>;
  delete(id: string): Promise<void>;
  requeue(primitives: DomainEventPrimitives): Promise<void>;
  clear(): Promise<void>;
  isProcessed(id: string): Promise<boolean>;
  isAcknowledged(eventId: string, subscriberId: string): Promise<boolean>;
  acknowledge(eventId: string, subscriberId: string): Promise<void>;
  prune(): Promise<number>;
}
