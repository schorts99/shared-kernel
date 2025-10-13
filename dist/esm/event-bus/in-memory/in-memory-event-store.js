"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryEventStore = void 0;
class InMemoryEventStore {
    events = [];
    save(primitives) {
        this.events.push(primitives);
    }
    all() {
        return [...this.events];
    }
    delete(id) {
        const index = this.events.findIndex(e => e.id === id);
        if (index !== -1)
            this.events.splice(index, 1);
    }
    requeue(primitives) {
        this.events.push(primitives);
    }
    clear() {
        this.events.length = 0;
    }
}
exports.InMemoryEventStore = InMemoryEventStore;
//# sourceMappingURL=in-memory-event-store.js.map