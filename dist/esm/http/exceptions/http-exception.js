"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPException = void 0;
class HTTPException extends Error {
    statusCode;
    body;
    constructor(statusCode, body) {
        super();
        this.statusCode = statusCode;
        this.body = body;
    }
}
exports.HTTPException = HTTPException;
//# sourceMappingURL=http-exception.js.map