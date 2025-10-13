import { DomainEventPrimitives } from "../../domain-events";
import { EventStore } from "../event-store";
export declare class InMemoryEventStore implements EventStore {
    private readonly events;
    save(primitives: DomainEventPrimitives): void;
    all(): DomainEventPrimitives[];
    delete(id: string): void;
    requeue(primitives: DomainEventPrimitives): void;
    clear(): void;
}
//# sourceMappingURL=in-memory-event-store.d.ts.map