import { Message } from "../messages";
import { DomainEventPrimitives } from "./domain-event-primitives";

export abstract class DomainEvent<PayloadSchema = {}> implements Message<DomainEventPrimitives<PayloadSchema>> {  
  constructor(
    readonly id: string,
    readonly occurredAt: Date,
    readonly type: string,
    readonly version: number,
    readonly payload: PayloadSchema,
  ) {}

  abstract getEventName(): string;
  abstract toPrimitives(): DomainEventPrimitives<PayloadSchema>;
}
