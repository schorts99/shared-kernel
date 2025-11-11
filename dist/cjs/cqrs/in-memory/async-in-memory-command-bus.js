"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncInMemoryCommandBus = void 0;
const __1 = require("..");
class AsyncInMemoryCommandBus {
    handlers = new Map();
    register(type, handler) {
        this.handlers.set(type, handler);
    }
    async dispatch(command) {
        const handler = this.handlers.get(command.getType());
        if (!handler) {
            throw new __1.CommandNotRegistered(command.getType());
        }
        return handler.handle(command);
    }
}
exports.AsyncInMemoryCommandBus = AsyncInMemoryCommandBus;
//# sourceMappingURL=async-in-memory-command-bus.js.map