"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainEventRegistry = void 0;
const exceptions_1 = require("./exceptions");
class DomainEventRegistry {
    static registry = new Map();
    static register(eventName, constructor) {
        this.registry.set(eventName, constructor);
    }
    static create(primitives) {
        const Constructor = this.registry.get(primitives.type);
        if (!Constructor) {
            throw new exceptions_1.DomainEventNotRegistered(primitives.type);
        }
        return new Constructor(primitives.id, new Date(primitives.occurred_at), primitives.type, primitives.version, primitives.payload, primitives.meta);
    }
}
exports.DomainEventRegistry = DomainEventRegistry;
//# sourceMappingURL=domain-event-registry.js.map