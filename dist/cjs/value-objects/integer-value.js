"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegerValue = void 0;
class IntegerValue {
    valueType = "Integer";
    min;
    max;
    value;
    constructor(value, min, max) {
        this.min = min;
        this.max = max;
        this.value = value;
        Object.freeze(this);
    }
    get isValid() {
        return (this.min !== undefined ? this.value >= this.min : true)
            && (this.max !== undefined ? this.value <= this.max : true)
            && Number.isInteger(this.value);
    }
    equals(valueObject) {
        if (!(valueObject instanceof IntegerValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return this.value === valueObject.value;
    }
}
exports.IntegerValue = IntegerValue;
//# sourceMappingURL=integer-value.js.map