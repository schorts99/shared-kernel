import { ValueObject } from "./";

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

  abstract readonly attributeName: string;
}
