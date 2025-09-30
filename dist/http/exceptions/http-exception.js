"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPException = void 0;
class HTTPException extends Error {
    message;
    statusCode;
    constructor(message, statusCode) {
        super();
        this.message = message;
        this.statusCode = statusCode;
    }
}
exports.HTTPException = HTTPException;
//# sourceMappingURL=http-exception.js.map