"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URLValue = void 0;
class URLValue {
    valueType = "URL";
    value;
    allowedHosts;
    constructor(value, allowedHosts = []) {
        this.value = value;
        this.allowedHosts = allowedHosts;
    }
    get isValid() {
        return this.allowedHosts.length === 0 || this.allowedHosts.includes(this.value.hostname);
    }
    equals(valueObject) {
        return (valueObject instanceof URLValue &&
            this.isValid &&
            valueObject.isValid &&
            this.value.href === valueObject.value.href);
    }
}
exports.URLValue = URLValue;
//# sourceMappingURL=url-value.js.map