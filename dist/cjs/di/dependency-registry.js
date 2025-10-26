"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyRegistry = void 0;
const exceptions_1 = require("./exceptions");
class DependencyRegistry {
    static registry = new Map();
    static registerSingleton(key, instance) {
        this.registry.set(key, () => instance);
    }
    static registerFactory(key, factory) {
        this.registry.set(key, factory);
    }
    static resolve(key) {
        const factory = this.registry.get(key);
        if (!factory)
            throw new exceptions_1.DependencyNotRegistered(`key: ${key}`);
        return factory();
    }
}
exports.DependencyRegistry = DependencyRegistry;
//# sourceMappingURL=dependency-registry.js.map