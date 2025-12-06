"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncInMemoryEventBus = void 0;
const domain_events_1 = require("../../../domain-events");
const sync_in_memory_event_store_1 = require("./sync-in-memory-event-store");
class SyncInMemoryEventBus {
    subscribers = new Map();
    store;
    maxRetries;
    deadLetterStore;
    constructor(store = new sync_in_memory_event_store_1.SyncInMemoryEventStore(), maxRetries = 3, deadLetterStore) {
        this.store = store;
        this.maxRetries = maxRetries;
        this.deadLetterStore = deadLetterStore;
    }
    subscribe(eventName, subscriber) {
        if (!this.subscribers.has(eventName)) {
            this.subscribers.set(eventName, []);
        }
        this.subscribers.get(eventName).push(subscriber);
    }
    publish(event) {
        const primitives = event.toPrimitives();
        this.store.save(primitives);
        this.dispatch(event);
    }
    dispatch(event) {
        const eventName = event.getEventName();
        const subs = this.subscribers.get(eventName) ?? [];
        const primitives = event.toPrimitives();
        event.ack = () => this.store.delete(event.id);
        event.requeue = (error) => {
            event.ack?.();
            if (event.meta.retries < this.maxRetries) {
                const updatedPrimitives = {
                    ...primitives,
                    meta: { ...primitives.meta, retries: event.meta.retries + 1 },
                };
                this.store.requeue(updatedPrimitives);
                this.publish(domain_events_1.DomainEventRegistry.create(updatedPrimitives));
            }
            else if (this.deadLetterStore) {
                const reason = error ? error.message : `Exceeded max retries (${this.maxRetries})`;
                this.deadLetterStore.add(primitives, reason);
            }
        };
        for (const sub of subs) {
            try {
                sub.handle(event);
            }
            catch (err) {
                event.requeue?.(err);
            }
        }
    }
    replay() {
        const events = this.store.all();
        for (const primitives of events) {
            const event = domain_events_1.DomainEventRegistry.create(primitives);
            this.dispatch(event);
        }
    }
}
exports.SyncInMemoryEventBus = SyncInMemoryEventBus;
//# sourceMappingURL=sync-in-memory-event-bus.js.map