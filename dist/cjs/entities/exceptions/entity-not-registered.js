"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityNotRegistered = void 0;
class EntityNotRegistered extends Error {
    constructor(tableOrCollectionName, translationResolver) {
        const message = translationResolver
            ? translationResolver.resolve("entities.errors.entity_not_registered")
            : `Entity Not Registered: ${tableOrCollectionName}`;
        super(message);
    }
}
exports.EntityNotRegistered = EntityNotRegistered;
//# sourceMappingURL=entity-not-registered.js.map