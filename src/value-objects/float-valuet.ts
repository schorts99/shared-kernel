import { ValueObject } from "./value-object";

export abstract class FloatValue implements ValueObject {
  readonly valueType = "Float";
  readonly value: number;
  readonly decimals: number | undefined;

  constructor(value: number, decimals?: number) {
    this.decimals = decimals;
    this.value = this.transform(value);
  }

  get isValid(): boolean {
    return !isNaN(this.value);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof FloatValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return this.value === valueObject.value;
  }

  abstract readonly attributeName: string;

  private transform(value: number): number {
    if (this.decimals === undefined) return value;

    const factor = Math.pow(10, this.decimals);

    return Math.round(value * factor) / factor;
  }
}
