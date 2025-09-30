"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoordinatesValue = void 0;
const EPSILON = 1e-6;
class CoordinatesValue {
    valueType = "Coordinates";
    value;
    constructor(value) {
        this.value = value;
    }
    get isValid() {
        const validLatitud = -90 <= this.value.latitude && this.value.latitude <= 90;
        const validLongitude = -180 <= this.value.longitude && this.value.longitude <= 180;
        return validLatitud && validLongitude;
    }
    get latitude() {
        if (this.isValid) {
            return this.value.latitude;
        }
        return null;
    }
    get longitude() {
        if (this.isValid) {
            return this.value.longitude;
        }
        return null;
    }
    equals(valueObject) {
        if (!(valueObject instanceof CoordinatesValue))
            return false;
        if (!this.isValid || !valueObject.isValid)
            return false;
        const latDiff = Math.abs(this.value.latitude - valueObject.value.latitude);
        const lonDiff = Math.abs(this.value.longitude - valueObject.value.longitude);
        return latDiff < EPSILON && lonDiff < EPSILON;
    }
}
exports.CoordinatesValue = CoordinatesValue;
//# sourceMappingURL=coordinates-value.js.map