"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryStateManager = void 0;
const state_manager_1 = require("./state-manager");
class InMemoryStateManager extends state_manager_1.StateManager {
    constructor(initialState = {}) {
        super(initialState);
    }
    async getValue(key) {
        return this.state[key];
    }
    async setValue(key, value) {
        this.state[key] = value;
        this.notifyListeners();
    }
    async removeValue(key) {
        delete this.state[key];
        this.notifyListeners();
    }
}
exports.InMemoryStateManager = InMemoryStateManager;
//# sourceMappingURL=in-memory-state-manager.js.map