export type DomainEventPrimitives<PayloadSchema = {}> = {
    id: string;
    occurred_at: string;
    type: string;
    version: number;
    payload: PayloadSchema;
    meta: {
        retries: number;
    };
};
//# sourceMappingURL=domain-event-primitives.d.ts.map