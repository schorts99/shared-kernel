import { DomainEvent } from "../domain-events";

export interface EventSubscriber<Event extends DomainEvent = DomainEvent> {
  handle(event: Event): void | Promise<void>;
}
