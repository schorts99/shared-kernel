"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityRegistry = void 0;
const exceptions_1 = require("./exceptions");
class EntityRegistry {
    static registry = new Map();
    static register(tableOrCollectionName, entity) {
        this.registry.set(tableOrCollectionName, entity);
    }
    static resolve(tableOrCollectionName) {
        return (this.registry.get(tableOrCollectionName) || null);
    }
    static create(tableOrCollectionName, model) {
        const entity = this.resolve(tableOrCollectionName);
        if (!entity) {
            throw new exceptions_1.EntityNotRegistered(tableOrCollectionName);
        }
        return entity.fromPrimitives(model);
    }
}
exports.EntityRegistry = EntityRegistry;
//# sourceMappingURL=entity-registry.js.map