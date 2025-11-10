"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncInMemoryEventStore = void 0;
class AsyncInMemoryEventStore {
    events = [];
    async save(primitives) {
        this.events.push(primitives);
    }
    async all() {
        return [...this.events];
    }
    async delete(id) {
        const index = this.events.findIndex(e => e.id === id);
        if (index !== -1)
            this.events.splice(index, 1);
    }
    async requeue(primitives) {
        this.events.push(primitives);
    }
    async clear() {
        this.events.length = 0;
    }
}
exports.AsyncInMemoryEventStore = AsyncInMemoryEventStore;
//# sourceMappingURL=async-in-memory-event-store.js.map