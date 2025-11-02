import { DomainEventPrimitives } from "./domain-event-primitives";
export declare abstract class DomainEvent<PayloadSchema = {}> {
    readonly id: string;
    readonly occurredAt: Date;
    readonly type: string;
    readonly version: number;
    readonly payload: PayloadSchema;
    meta: {
        retries: number;
    };
    constructor(id: string, occurredAt: Date, type: string, version: number, payload: PayloadSchema, meta?: {
        retries: number;
    });
    abstract getEventName(): string;
    toPrimitives(): DomainEventPrimitives<PayloadSchema>;
    ack?: () => void;
    requeue?: () => void;
}
//# sourceMappingURL=domain-event.d.ts.map