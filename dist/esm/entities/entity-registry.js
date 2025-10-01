"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityRegistry = void 0;
const exceptions_1 = require("./exceptions");
class EntityRegistry {
    static registry = new Map();
    static register(type, entity) {
        this.registry.set(type, entity);
    }
    static resolve(type) {
        return (this.registry.get(type) || null);
    }
    static create(type, model) {
        const entity = this.resolve(type);
        if (!entity) {
            throw new exceptions_1.EntityNotRegistered(`Entity type "${type}" not registered`);
        }
        return entity.fromPrimitives(model);
    }
}
exports.EntityRegistry = EntityRegistry;
//# sourceMappingURL=entity-registry.js.map