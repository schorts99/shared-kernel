"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UUIDValue = void 0;
const REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class UUIDValue {
    valueType = "UUID";
    value;
    optional;
    constructor(value, optional = false) {
        this.value = value;
        this.optional = optional;
    }
    get isValid() {
        return this.optional
            ? this.value
                ? REGEX.test(this.value)
                : true
            : REGEX.test(this.value);
    }
    equals(valueObject) {
        if (!(valueObject instanceof UUIDValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return this.value === valueObject.value;
    }
}
exports.UUIDValue = UUIDValue;
//# sourceMappingURL=uuid-value.js.map