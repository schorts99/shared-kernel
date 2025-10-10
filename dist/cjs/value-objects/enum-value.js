"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnumValue = void 0;
class EnumValue {
    valueType = 'Enum';
    allowedValues;
    value;
    constructor(allowedValues, value) {
        this.allowedValues = allowedValues;
        this.value = value;
    }
    get isValid() {
        return this.allowedValues.includes(this.value);
    }
    equals(valueObject) {
        return (valueObject instanceof EnumValue &&
            this.isValid &&
            valueObject.isValid &&
            this.value === valueObject.value);
    }
}
exports.EnumValue = EnumValue;
//# sourceMappingURL=enum-value.js.map