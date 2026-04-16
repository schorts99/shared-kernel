import { DomainEventPrimitives } from "../domain-events";
import { MaybePromise } from "../types";

export interface EventStore {
  save(primitives: DomainEventPrimitives): Promise<void>;
  all(): Promise<DomainEventPrimitives[]>;
  delete(id: string): Promise<void>;
  requeue(primitives: DomainEventPrimitives): Promise<void>;
  clear(): Promise<void>;
  isProcessed(id: string): Promise<boolean>;
}
