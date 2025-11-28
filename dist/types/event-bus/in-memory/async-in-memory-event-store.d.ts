import { DomainEventPrimitives } from "../../domain-events";
import { EventStore } from "../event-store";
export declare class AsyncInMemoryEventStore implements EventStore<true> {
    private readonly events;
    save(primitives: DomainEventPrimitives): Promise<void>;
    all(): Promise<DomainEventPrimitives[]>;
    delete(id: string): Promise<void>;
    requeue(primitives: DomainEventPrimitives): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=async-in-memory-event-store.d.ts.map