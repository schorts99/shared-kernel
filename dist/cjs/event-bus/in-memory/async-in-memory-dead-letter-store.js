"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncInMemoryDeadLetterStore = void 0;
class AsyncInMemoryDeadLetterStore {
    failed = [];
    async add(primitives, reason) {
        this.failed.push({ primitives, reason });
    }
    async all() {
        return [...this.failed];
    }
    async clear() {
        this.failed.length = 0;
    }
}
exports.AsyncInMemoryDeadLetterStore = AsyncInMemoryDeadLetterStore;
//# sourceMappingURL=async-in-memory-dead-letter-store.js.map