"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterEntity = exports.EntityRegistry = exports.Entity = void 0;
var entity_1 = require("./entity");
Object.defineProperty(exports, "Entity", { enumerable: true, get: function () { return entity_1.Entity; } });
var entity_registry_1 = require("./entity-registry");
Object.defineProperty(exports, "EntityRegistry", { enumerable: true, get: function () { return entity_registry_1.EntityRegistry; } });
__exportStar(require("./exceptions"), exports);
var register_entity_decorator_1 = require("./register-entity.decorator");
Object.defineProperty(exports, "RegisterEntity", { enumerable: true, get: function () { return register_entity_decorator_1.RegisterEntity; } });
//# sourceMappingURL=index.js.map