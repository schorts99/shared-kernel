export type DomainEventPrimitives<PayloadSchema = {}> = {
    id: string;
    occurred_at: string;
    type: string;
    version: number;
    payload: PayloadSchema;
};
//# sourceMappingURL=domain-event-primitives.d.ts.map