import { ValueObject } from "./value-object";

export abstract class FloatValue implements ValueObject {
  readonly valueType = "Float";
  readonly value: number;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly decimals: number | undefined;

  constructor(value: number, decimals?: number, min?: number, max?: number) {
    this.decimals = decimals;
    this.min = min;
    this.max = max;
    this.value = this.transform(value);
  }

  get isValid(): boolean {
    return (
      typeof this.value === "number" &&
      Number.isFinite(this.value) &&
      (this.min !== undefined ? this.value >= this.min : true) &&
      (this.max !== undefined ? this.value <= this.max : true)
    );
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof FloatValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return this.value === valueObject.value;
  }

  toString(): string {
    return String(this.value);
  }

  toJSON(): number {
    return this.value;
  }

  toPrimitives(): number {
    return this.value;
  }

  static fromPrimitives<V extends FloatValue = FloatValue>(
    this: new (value: number, decimals?: number, min?: number, max?: number) => V,
    value: number,
    decimals?: number,
    min?: number,
    max?: number,
  ): V {
    return new this(value, decimals, min, max);
  }

  abstract readonly attributeName: string;

  private transform(value: number): number {
    if (this.decimals === undefined || !Number.isFinite(value)) return value;
    if (!Number.isInteger(this.decimals) || this.decimals < 0) return Number.NaN;

    const shifted = Number(`${value}e+${this.decimals}`);
    if (Number.isFinite(shifted)) {
      return Number(`${Math.round(shifted)}e-${this.decimals}`);
    }

    const factor = Math.pow(10, this.decimals);
    return Math.round(value * factor) / factor;
  }
}
