"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterEntity = RegisterEntity;
const entity_registry_1 = require("./entity-registry");
function RegisterEntity(type) {
    return function (entity) {
        entity_registry_1.EntityRegistry.register(type, entity);
        return entity;
    };
}
//# sourceMappingURL=register-entity.decorator.js.map