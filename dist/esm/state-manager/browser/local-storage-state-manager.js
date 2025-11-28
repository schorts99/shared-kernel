"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorageStateManager = void 0;
const state_manager_1 = require("../state-manager");
class LocalStorageStateManager extends state_manager_1.StateManager {
    constructor(initialState) {
        super(initialState);
        this.loadPersistedState();
    }
    getValue(key) {
        return this.state[key];
    }
    setValue(key, value) {
        this.state = {
            ...this.state,
            [key]: value
        };
        this.persistValue(key, value);
        this.notifyListeners();
    }
    removeValue(key) {
        const storageKey = String(key);
        const { [key]: _, ...newState } = this.state;
        this.state = newState;
        localStorage.removeItem(storageKey);
        this.notifyListeners();
    }
    loadPersistedState() {
        const keys = Object.keys(this.state);
        for (const key of keys) {
            const storageKey = String(key);
            const persistedValue = localStorage.getItem(storageKey);
            this.state[key] = JSON.parse(persistedValue || "null");
        }
    }
    persistValue(key, value) {
        const storageKey = String(key);
        localStorage.setItem(storageKey, JSON.stringify(value));
    }
}
exports.LocalStorageStateManager = LocalStorageStateManager;
//# sourceMappingURL=local-storage-state-manager.js.map