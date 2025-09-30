"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlugValue = void 0;
const REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
class SlugValue {
    valueType = "Slug";
    value;
    constructor(value) {
        this.value = value;
    }
    get isValid() {
        return REGEX.test(this.value);
    }
    equals(valueObject) {
        if (!(valueObject instanceof SlugValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return this.value === valueObject.value;
    }
}
exports.SlugValue = SlugValue;
//# sourceMappingURL=slug-value.js.map