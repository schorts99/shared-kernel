import { ValueObject } from "./";

const EPSILON = 1e-6;

export abstract class CoordinatesValue implements ValueObject {
  readonly valueType = "Coordinates";
  readonly value: {
    latitude: number,
    longitude: number,
  };

  constructor(value: CoordinatesValue["value"]) {
    this.value = value;
  }

  get isValid(): boolean {
    const validLatitud = -90 <= this.value.latitude && this.value.latitude <= 90;
    const validLongitude = -180 <= this.value.longitude && this.value.longitude <= 180;

    return validLatitud && validLongitude;
  }

  get latitude(): number | null {
    if (this.isValid) {
      return this.value.latitude;
    }

    return null
  }

  get longitude(): number | null {
    if (this.isValid) {
      return this.value.longitude;
    }

    return null;
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof CoordinatesValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;
  
    const latDiff = Math.abs(this.value.latitude - valueObject.value.latitude);
    const lonDiff = Math.abs(this.value.longitude - valueObject.value.longitude);
  
    return latDiff < EPSILON && lonDiff < EPSILON;
  }

  abstract readonly attributeName: string;
}
