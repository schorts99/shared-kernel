import { DomainEventPrimitives } from "../domain-events";
import { EventSubscriber } from "./event-subscriber";

export interface DeadLetterStore {
  add(primitives: DomainEventPrimitives, reason: string, subscriber?: EventSubscriber<any>): Promise<void>;
  all(): Promise<Array<{ primitives: DomainEventPrimitives; reason: string; subscriber?: EventSubscriber<any> }>>;
  clear(): Promise<void>;
}
