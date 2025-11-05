"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopedLogger = exports.ConsoleLogger = exports.Logger = void 0;
var logger_1 = require("./logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
var console_logger_1 = require("./console-logger");
Object.defineProperty(exports, "ConsoleLogger", { enumerable: true, get: function () { return console_logger_1.ConsoleLogger; } });
var scoped_logger_1 = require("./scoped-logger");
Object.defineProperty(exports, "ScopedLogger", { enumerable: true, get: function () { return scoped_logger_1.ScopedLogger; } });
//# sourceMappingURL=index.js.map