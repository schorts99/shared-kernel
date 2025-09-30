"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateManager = void 0;
class StateManager {
    state;
    listeners = [];
    constructor(initialState = {}) {
        this.state = initialState;
    }
    getState() {
        return this.state;
    }
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }
}
exports.StateManager = StateManager;
//# sourceMappingURL=state-manager.js.map