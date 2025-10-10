"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateValue = void 0;
class DateValue {
    valueType = "Date";
    value;
    beforeDate;
    afterDate;
    constructor(value, beforeDate, afterDate) {
        this.value = value;
        this.beforeDate = beforeDate;
        this.afterDate = afterDate;
    }
    get isValid() {
        if (this.beforeDate && this.value > this.beforeDate)
            return false;
        if (this.afterDate && this.value < this.afterDate)
            return false;
        return true;
    }
    equals(valueObject) {
        if (!(valueObject instanceof DateValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return this.value.getTime() === valueObject.value.getTime();
    }
}
exports.DateValue = DateValue;
//# sourceMappingURL=date-value.js.map