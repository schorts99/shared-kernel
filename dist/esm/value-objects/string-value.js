"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringValue = void 0;
class StringValue {
    valueType = "String";
    value;
    minLength;
    maxLength;
    constructor(value, minLength = 0, maxLength) {
        this.value = value;
        this.minLength = minLength;
        this.maxLength = maxLength;
    }
    get isValid() {
        return this.value.length >= this.minLength && (this.maxLength ? this.value.length <= this.maxLength : true);
    }
    equals(valueObject) {
        if (!(valueObject instanceof StringValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return this.value === valueObject.value;
    }
}
exports.StringValue = StringValue;
//# sourceMappingURL=string-value.js.map