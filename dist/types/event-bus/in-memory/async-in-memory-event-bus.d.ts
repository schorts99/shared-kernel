import { DomainEvent } from "../../domain-events";
import { EventStore } from "../event-store";
import { EventSubscriber } from "../event-subscriber";
import { EventBus } from "../event-bus";
import { DeadLetterStore } from "../dead-letter-store";
export declare class AsyncInMemoryEventBus implements EventBus {
    private readonly subscribers;
    private readonly store;
    private readonly maxRetries;
    private readonly deadLetterStore;
    constructor(store?: EventStore, maxRetries?: number, deadLetterStore?: DeadLetterStore);
    subscribe<Event extends DomainEvent>(eventName: string, subscriber: EventSubscriber<Event>): void;
    publish<Event extends DomainEvent>(event: Event): Promise<void>;
    private dispatch;
    replay(): Promise<void>;
}
//# sourceMappingURL=async-in-memory-event-bus.d.ts.map