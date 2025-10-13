import { Message } from "../messages";
import { DomainEventPrimitives } from "./domain-event-primitives";

export abstract class DomainEvent<PayloadSchema = {}> implements Message<DomainEventPrimitives<PayloadSchema>> {  
  constructor(
    readonly id: string,
    readonly occurredAt: Date,
    readonly type: string,
    readonly version: number,
    readonly payload: PayloadSchema,
    public meta = { retries: 0 },
  ) {}

  abstract getEventName(): string;

  toPrimitives(): DomainEventPrimitives<PayloadSchema> {
    return {
      id: this.id,
      occurred_at: this.occurredAt.toString(),
      type: this.type,
      version: this.version,
      payload: this.payload,
      meta: this.meta,
    };
  }

  ack?: () => void;
  requeue?: () => void;
}
