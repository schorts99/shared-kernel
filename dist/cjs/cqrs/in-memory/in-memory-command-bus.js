"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryCommandBus = void 0;
const __1 = require("../");
class InMemoryCommandBus {
    handlers = new Map();
    register(type, handler) {
        this.handlers.set(type, handler);
    }
    async dispatch(command) {
        const handler = this.handlers.get(command.getType());
        if (!handler) {
            throw new __1.CommandNotRegistered(command.getType());
        }
        await handler.handle(command);
    }
}
exports.InMemoryCommandBus = InMemoryCommandBus;
//# sourceMappingURL=in-memory-command-bus.js.map