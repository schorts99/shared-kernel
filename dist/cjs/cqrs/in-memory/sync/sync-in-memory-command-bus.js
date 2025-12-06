"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncInMemoryCommandBus = void 0;
const index_1 = require("../../index");
class SyncInMemoryCommandBus {
    handlers = new Map();
    register(type, handler) {
        this.handlers.set(type, handler);
    }
    async dispatch(command) {
        const handler = this.handlers.get(command.getType());
        if (!handler) {
            throw new index_1.CommandNotRegistered(command.getType());
        }
        return handler.handle(command);
    }
}
exports.SyncInMemoryCommandBus = SyncInMemoryCommandBus;
//# sourceMappingURL=sync-in-memory-command-bus.js.map