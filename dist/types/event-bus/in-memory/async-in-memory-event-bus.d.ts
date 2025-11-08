import { DomainEvent } from "../../domain-events";
import { EventStore } from "../event-store";
import { EventSubscriber } from "../event-subscriber";
import { EventBus } from "../event-bus";
export declare class AsyncInMemoryEventBus implements EventBus {
    private readonly subscribers;
    private readonly store;
    private readonly maxRetries;
    constructor(store?: EventStore, maxRetries?: number);
    subscribe<Event extends DomainEvent>(eventName: string, subscriber: EventSubscriber<Event>): void;
    publish<Event extends DomainEvent>(event: Event): Promise<void>;
    private dispatch;
    replay(): Promise<void>;
}
//# sourceMappingURL=async-in-memory-event-bus.d.ts.map