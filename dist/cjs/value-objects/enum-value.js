"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnumValue = void 0;
class EnumValue {
    valueType = 'Enum';
    allowedValues;
    optional;
    value;
    constructor(allowedValues, value, optional = false) {
        this.allowedValues = allowedValues;
        this.optional = optional;
        this.value = value;
    }
    get isValid() {
        if (this.optional && this.value === null)
            return true;
        if (!this.optional && this.value === null)
            return false;
        return this.allowedValues.includes(this.value);
    }
    equals(valueObject) {
        if (!(valueObject instanceof EnumValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return this.value === valueObject.value;
    }
}
exports.EnumValue = EnumValue;
//# sourceMappingURL=enum-value.js.map