"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleTelemetry = void 0;
class ConsoleTelemetry {
    customContext = {};
    transaction = null;
    init() {
        console.log("Telemetry initialized");
    }
    trackError(error) {
        console.error({
            error,
            timestamp: new Date(),
            customContext: this.customContext,
            transaction: this.transaction,
        });
    }
    setCustomContext(key, value) {
        this.customContext[key] = value;
    }
    setTransaction(name) {
        this.transaction = name;
    }
}
exports.ConsoleTelemetry = ConsoleTelemetry;
//# sourceMappingURL=console-telemetry.js.map