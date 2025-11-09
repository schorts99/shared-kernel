"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = void 0;
const _1 = require("./");
const LOG_LEVELS = {
    ERROR: 5,
    WARN: 4,
    DEBUG: 3,
    INFO: 2,
    LOG: 1,
};
class ConsoleLogger extends _1.Logger {
    level;
    constructor(level = "ERROR") {
        super();
        this.level = level;
    }
    log(context, ...args) {
        if (LOG_LEVELS[this.level] < LOG_LEVELS["LOG"])
            return;
        console.log(this.context(context), ...args);
    }
    info(context, ...args) {
        if (LOG_LEVELS[this.level] < LOG_LEVELS["INFO"])
            return;
        console.info(this.context(context), ...args);
    }
    debug(context, ...args) {
        if (LOG_LEVELS[this.level] < LOG_LEVELS["DEBUG"])
            return;
        console.debug(this.context(context), ...args);
    }
    warn(context, ...args) {
        if (LOG_LEVELS[this.level] < LOG_LEVELS["WARN"])
            return;
        console.warn(this.context(context), ...args);
    }
    error(context, ...args) {
        if (LOG_LEVELS[this.level] < LOG_LEVELS["ERROR"])
            return;
        console.error(this.context(context), ...args);
    }
    context(customContext) {
        return {
            timestamp: Date.now(),
            ...customContext,
        };
    }
}
exports.ConsoleLogger = ConsoleLogger;
//# sourceMappingURL=console-logger.js.map