import { DomainEvent } from "../domain-events";
import { MaybePromise } from "../types";

export interface EventSubscriber<
  Event extends DomainEvent = DomainEvent,
  IsAsync extends boolean = false,
> {
  handle(event: Event): MaybePromise<IsAsync, void>;
}
