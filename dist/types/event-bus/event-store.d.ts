import { DomainEventPrimitives } from "../domain-events";
export interface EventStore {
    save(primitives: DomainEventPrimitives): void;
    all(): DomainEventPrimitives[];
    delete(id: string): void;
    requeue(primitives: DomainEventPrimitives): void;
    clear(): void;
}
//# sourceMappingURL=event-store.d.ts.map