"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneValue = void 0;
const REGEX = /\+(9[976]\d|8[987530]\d|6[987]\d|5[90]\d|42\d|3[875]\d|2[98654321]\d|9[8543210]|8[6421]|6[6543210]|5[87654321]|4[987654310]|3[9643210]|2[70]|7|1)\d{10,12}$/;
class PhoneValue {
    valueType = "Phone";
    value;
    constructor(value) {
        this.value = value;
    }
    get isValid() {
        return REGEX.test(this.value);
    }
    get countryCode() {
        if (this.isValid) {
            const countryCodeLength = this.value.length - 10;
            return this.value.slice(0, countryCodeLength);
        }
        return null;
    }
    get phoneNumber() {
        if (this.isValid) {
            return this.value.slice(-10);
        }
        return null;
    }
    get formattedPhone() {
        if (this.isValid) {
            const phoneNumber = this.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
            return `${this.countryCode} ${phoneNumber}`;
        }
        return null;
    }
    equals(valueObject) {
        if (!(valueObject instanceof PhoneValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        return this.value === valueObject.value;
    }
}
exports.PhoneValue = PhoneValue;
//# sourceMappingURL=phone-value.js.map