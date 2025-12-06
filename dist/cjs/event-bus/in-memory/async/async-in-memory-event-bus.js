"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncInMemoryEventBus = void 0;
const domain_events_1 = require("../../../domain-events");
const async_in_memory_event_store_1 = require("./async-in-memory-event-store");
class AsyncInMemoryEventBus {
    subscribers = new Map();
    store;
    maxRetries;
    deadLetterStore;
    constructor(store = new async_in_memory_event_store_1.AsyncInMemoryEventStore(), maxRetries = 3, deadLetterStore) {
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
    async publish(event) {
        const primitives = event.toPrimitives();
        this.store.save(primitives);
        await this.dispatch(event);
    }
    async dispatch(event) {
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
                await sub.handle(event);
            }
            catch (err) {
                event.requeue?.(err);
            }
        }
    }
    async replay() {
        const events = await this.store.all();
        for (const primitives of events) {
            const event = domain_events_1.DomainEventRegistry.create(primitives);
            await this.dispatch(event);
        }
    }
}
exports.AsyncInMemoryEventBus = AsyncInMemoryEventBus;
//# sourceMappingURL=async-in-memory-event-bus.js.map