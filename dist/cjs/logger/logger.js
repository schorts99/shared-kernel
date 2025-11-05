"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const _1 = require("./");
class Logger {
    child(context) {
        return new _1.ScopedLogger(this, context);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map