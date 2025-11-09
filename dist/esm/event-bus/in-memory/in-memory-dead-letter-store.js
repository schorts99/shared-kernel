"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryDeadLetterStore = void 0;
class InMemoryDeadLetterStore {
    failed = [];
    add(primitives, reason) {
        this.failed.push({ primitives, reason });
    }
    all() {
        return [...this.failed];
    }
    clear() {
        this.failed.length = 0;
    }
}
exports.InMemoryDeadLetterStore = InMemoryDeadLetterStore;
//# sourceMappingURL=in-memory-dead-letter-store.js.map