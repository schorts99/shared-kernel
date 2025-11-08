import { DomainEvent } from "../domain-events";
import { EventSubscriber } from "./event-subscriber";

export interface EventBus {
  subscribe<Event extends DomainEvent>(eventName: string, subscriber: EventSubscriber<Event>): void;
  publish<Event extends DomainEvent>(event: Event): Promise<void>;
  replay(): Promise<void>;
}
