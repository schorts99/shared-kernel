"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValuesNotValid = void 0;
class ValuesNotValid extends Error {
    errors;
    constructor(errors) {
        super();
        this.errors = errors;
    }
}
exports.ValuesNotValid = ValuesNotValid;
//# sourceMappingURL=values-not-valid.js.map