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
    if (!this.value || typeof this.value !== "object") return false;
    const { latitude, longitude } = this.value;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    const validLatitude = -90 <= latitude && latitude <= 90;
    const validLongitude = -180 <= longitude && longitude <= 180;

    return validLatitude && validLongitude;
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

  toPrimitives(): CoordinatesValue["value"] {
    return { ...this.value };
  }

  static fromPrimitives<V extends CoordinatesValue = CoordinatesValue>(
    this: new (value: CoordinatesValue["value"]) => V,
    value: CoordinatesValue["value"],
  ): V {
    return new this(value);
  }

  abstract readonly attributeName: string;
}
