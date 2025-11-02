"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryQueryBus = void 0;
const __1 = require("../");
class InMemoryQueryBus {
    handlers = new Map();
    register(type, handler) {
        this.handlers.set(type, handler);
    }
    async dispatch(query) {
        const handler = this.handlers.get(query.type);
        if (!handler) {
            throw new __1.QueryNotRegistered(query.type);
        }
        return await handler.handle(query);
    }
}
exports.InMemoryQueryBus = InMemoryQueryBus;
//# sourceMappingURL=in-memory-query-bus.js.map