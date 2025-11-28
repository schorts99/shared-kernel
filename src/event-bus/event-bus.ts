import { DomainEvent } from "../domain-events";
import { EventSubscriber } from "./event-subscriber";
import { MaybePromise } from "../types";

export interface EventBus<IsAsync extends boolean = false> {
  subscribe<Event extends DomainEvent>(eventName: string, subscriber: EventSubscriber<Event>): void;
  publish<Event extends DomainEvent>(event: Event): MaybePromise<IsAsync, void>;
  replay(): MaybePromise<IsAsync, void>;
}
