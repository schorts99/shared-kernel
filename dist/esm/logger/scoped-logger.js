"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopedLogger = void 0;
const _1 = require("./");
class ScopedLogger extends _1.Logger {
    base;
    baseContext;
    constructor(base, baseContext) {
        super();
        this.base = base;
        this.baseContext = baseContext;
    }
    log(context, ...args) {
        this.base.log({ ...this.baseContext, ...context }, ...args);
    }
    info(context, ...args) {
        this.base.info({ ...this.baseContext, ...context }, ...args);
    }
    debug(context, ...args) {
        this.base.debug({ ...this.baseContext, ...context }, ...args);
    }
    warn(context, ...args) {
        this.base.warn({ ...this.baseContext, ...context }, ...args);
    }
    error(context, ...args) {
        this.base.error({ ...this.baseContext, ...context }, ...args);
    }
    child(context) {
        return new ScopedLogger(this.base, { ...this.baseContext, ...context });
    }
}
exports.ScopedLogger = ScopedLogger;
//# sourceMappingURL=scoped-logger.js.map