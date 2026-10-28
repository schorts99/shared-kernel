import { DomainEventPrimitives } from "../domain-events/index.js";
import { EventSubscriber } from "./event-subscriber.js";

export interface DeadLetterStore {
  add(primitives: DomainEventPrimitives, reason: string, subscriber?: EventSubscriber<any>): Promise<void>;
  all(): Promise<Array<{ primitives: DomainEventPrimitives; reason: string; subscriber?: EventSubscriber<any> }>>;
  clear(): Promise<void>;
}
