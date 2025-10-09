"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BooleanValue = void 0;
class BooleanValue {
    valueType = "Boolean";
    value;
    constructor(value) {
        this.value = value;
    }
    get isValid() {
        return true;
    }
    equals(valueObject) {
        if (!(valueObject instanceof BooleanValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return this.value === valueObject.value;
    }
}
exports.BooleanValue = BooleanValue;
//# sourceMappingURL=boolean-value.js.map