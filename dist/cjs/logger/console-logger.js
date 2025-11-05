"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = void 0;
const _1 = require("./");
class ConsoleLogger extends _1.Logger {
    log(context, ...args) {
        console.log(this.context(context), ...args);
    }
    info(context, ...args) {
        console.info(this.context(context), ...args);
    }
    debug(context, ...args) {
        console.debug(this.context(context), ...args);
    }
    warn(context, ...args) {
        console.warn(this.context(context), ...args);
    }
    error(context, ...args) {
        console.error(this.context(context), ...args);
    }
    context(customContext) {
        return {
            timestamp: new Date(),
            ...customContext,
        };
    }
}
exports.ConsoleLogger = ConsoleLogger;
//# sourceMappingURL=console-logger.js.map