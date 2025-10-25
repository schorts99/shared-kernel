"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectValue = void 0;
class ObjectValue {
    valueType = "Object";
    value;
    schema;
    constructor(value, schema) {
        this.value = this.deepFreeze(value);
        this.schema = schema;
    }
    get isValid() {
        return this.validateObject(this.value, this.schema);
    }
    equals(valueObject) {
        if (!(valueObject instanceof ObjectValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return JSON.stringify(this.value) === JSON.stringify(valueObject.value);
    }
    validateObject(obj, schema) {
        return Object.entries(schema).every(([key, rulesOrNested]) => {
            const value = obj[key];
            if (Array.isArray(rulesOrNested)) {
                return rulesOrNested.every(rule => this.validateRule(value, rule));
            }
            if (typeof rulesOrNested === "object" && value !== null && typeof value === "object") {
                return this.validateObject(value, rulesOrNested);
            }
            return true;
        });
    }
    validateRule(value, rule) {
        if ("required" in rule)
            return value !== undefined && value !== null;
        if ("greater_than" in rule)
            return typeof value === "number" && value > rule.greater_than;
        if ("greater_than_or_equal" in rule)
            return typeof value === "number" && value >= rule.greater_than_or_equal;
        if ("less_than" in rule)
            return typeof value === "number" && value < rule.less_than;
        if ("less_than_or_equal" in rule)
            return typeof value === "number" && value <= rule.less_than_or_equal;
        if ("type" in rule)
            return typeof value === rule.type;
        if ("enum" in rule)
            return rule.enum.includes(value);
        if ("custom" in rule)
            return rule.custom(value);
        return true;
    }
    deepFreeze(obj) {
        if (Array.isArray(obj)) {
            obj.forEach(item => this.deepFreeze(item));
        }
        else if (obj && typeof obj === "object") {
            Object.getOwnPropertyNames(obj).forEach(prop => {
                const value = obj[prop];
                if (value && typeof value === "object") {
                    this.deepFreeze(value);
                }
            });
        }
        return Object.freeze(obj);
    }
}
exports.ObjectValue = ObjectValue;
//# sourceMappingURL=object-value.js.map