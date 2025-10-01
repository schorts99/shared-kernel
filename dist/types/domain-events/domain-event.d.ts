import { Message } from "../messages";
import { DomainEventPrimitives } from "./domain-event-primitives";
export declare abstract class DomainEvent<PayloadSchema = {}> implements Message<DomainEventPrimitives<PayloadSchema>> {
    readonly id: string;
    readonly occurredAt: Date;
    readonly type: string;
    readonly version: number;
    readonly payload: PayloadSchema;
    constructor(id: string, occurredAt: Date, type: string, version: number, payload: PayloadSchema);
    abstract getEventName(): string;
    abstract toPrimitives(): DomainEventPrimitives<PayloadSchema>;
}
//# sourceMappingURL=domain-event.d.ts.map