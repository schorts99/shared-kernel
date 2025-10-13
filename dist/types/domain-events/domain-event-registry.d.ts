import { DomainEvent, DomainEventPrimitives } from ".";
type DomainEventConstructor<PayloadSchema = any> = {
    new (id: string, occurredAt: Date, type: string, version: number, payload: PayloadSchema, meta: {
        retries: number;
    }): DomainEvent<PayloadSchema>;
};
export declare class DomainEventRegistry {
    private static registry;
    static register(eventName: string, constructor: DomainEventConstructor): void;
    static create(primitives: DomainEventPrimitives): DomainEvent;
}
export {};
//# sourceMappingURL=domain-event-registry.d.ts.map