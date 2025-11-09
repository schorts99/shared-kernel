"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncInMemoryQueryBus = void 0;
const __1 = require("..");
class AsyncInMemoryQueryBus {
    handlers = new Map();
    register(type, handler) {
        this.handlers.set(type, handler);
    }
    async dispatch(query) {
        const handler = this.handlers.get(query.getType());
        if (!handler) {
            throw new __1.QueryNotRegistered(query.getType());
        }
        return await handler.handle(query);
    }
}
exports.AsyncInMemoryQueryBus = AsyncInMemoryQueryBus;
//# sourceMappingURL=async-in-memory-query-bus.js.map