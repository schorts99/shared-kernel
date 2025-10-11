"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONAPIErrors = void 0;
class JSONAPIErrors extends Error {
    errors;
    constructor(errors) {
        super();
        this.errors = errors;
    }
}
exports.JSONAPIErrors = JSONAPIErrors;
//# sourceMappingURL=json-api-errors.js.map