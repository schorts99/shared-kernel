"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncInMemoryDeadLetterStore = void 0;
class SyncInMemoryDeadLetterStore {
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
exports.SyncInMemoryDeadLetterStore = SyncInMemoryDeadLetterStore;
//# sourceMappingURL=sync-in-memory-dead-letter-store.js.map