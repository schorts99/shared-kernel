import { DomainEvent } from "../../../domain-events";
import { EventStore } from "../../event-store";
import { EventSubscriber } from "../../event-subscriber";
import { EventBus } from "../../index";
import { DeadLetterStore } from "../../dead-letter-store";
export declare class SyncInMemoryEventBus implements EventBus {
    private readonly subscribers;
    private readonly store;
    private readonly maxRetries;
    private readonly deadLetterStore;
    constructor(store?: EventStore, maxRetries?: number, deadLetterStore?: DeadLetterStore);
    subscribe<Event extends DomainEvent>(eventName: string, subscriber: EventSubscriber<Event>): void;
    publish<Event extends DomainEvent>(event: Event): void;
    private dispatch;
    replay(): void;
}
//# sourceMappingURL=sync-in-memory-event-bus.d.ts.map