"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloatValue = void 0;
class FloatValue {
    valueType = "Float";
    value;
    min;
    max;
    decimals;
    constructor(value, decimals, min, max) {
        this.decimals = decimals;
        this.min = min;
        this.max = max;
        this.value = this.transform(value);
        Object.freeze(this);
    }
    get isValid() {
        return !isNaN(this.value)
            && (this.min !== undefined ? this.value >= this.min : true)
            && (this.max !== undefined ? this.value <= this.max : true);
    }
    equals(valueObject) {
        if (!(valueObject instanceof FloatValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return this.value === valueObject.value;
    }
    transform(value) {
        if (this.decimals === undefined)
            return value;
        const factor = Math.pow(10, this.decimals);
        return Math.round(value * factor) / factor;
    }
}
exports.FloatValue = FloatValue;
//# sourceMappingURL=float-valuet.js.map