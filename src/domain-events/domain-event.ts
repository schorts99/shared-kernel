import { Message } from "../messages";
import { DomainEventPrimitives } from "./domain-event-primitives";

export abstract class DomainEvent<PayloadSchema = {}> implements Message<DomainEventPrimitives<PayloadSchema>> {
  abstract id: string;
  abstract occurredAt: Date;
  abstract type: string;
  abstract version: number;
  abstract payload: PayloadSchema;
  abstract getEventName: string;
  
  abstract toPrimitives(): DomainEventPrimitives<PayloadSchema>;
}
