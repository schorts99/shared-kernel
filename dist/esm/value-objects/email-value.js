"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailValue = void 0;
const REGEX = /^([A-Za-z0-9_\-\.])+\@(?!(?:[A-Za-z0-9_\-\.]+\.)?com\.com)([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
class EmailValue {
    valueType = "Email";
    value;
    constructor(value) {
        this.value = value;
    }
    get isValid() {
        return REGEX.test(this.value);
    }
    equals(valueObject) {
        if (!(valueObject instanceof EmailValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return this.value === valueObject.value;
    }
}
exports.EmailValue = EmailValue;
//# sourceMappingURL=email-value.js.map