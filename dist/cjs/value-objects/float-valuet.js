"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloatValue = void 0;
class FloatValue {
    valueType = "Float";
    value;
    decimals;
    constructor(value, decimals) {
        this.decimals = decimals;
        this.value = this.transform(value);
    }
    get isValid() {
        return !isNaN(this.value);
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