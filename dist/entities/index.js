"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterEntity = exports.EntityNotRegistered = exports.EntityRegistry = exports.Entity = void 0;
var entity_1 = require("./entity");
Object.defineProperty(exports, "Entity", { enumerable: true, get: function () { return entity_1.Entity; } });
var entity_registry_1 = require("./entity-registry");
Object.defineProperty(exports, "EntityRegistry", { enumerable: true, get: function () { return entity_registry_1.EntityRegistry; } });
var exceptions_1 = require("./exceptions");
Object.defineProperty(exports, "EntityNotRegistered", { enumerable: true, get: function () { return exceptions_1.EntityNotRegistered; } });
var register_entity_decorator_1 = require("./register-entity.decorator");
Object.defineProperty(exports, "RegisterEntity", { enumerable: true, get: function () { return register_entity_decorator_1.RegisterEntity; } });
//# sourceMappingURL=index.js.map