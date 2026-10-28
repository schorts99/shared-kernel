import { ValueObject } from "./";

export abstract class IntegerValue implements ValueObject {
  readonly valueType = "Integer";
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly value: number;

  constructor(value: number, min?: number, max?: number) {
    this.min = min;
    this.max = max;
    this.value = value;
  }

  get isValid(): boolean {
    return (this.min !== undefined ? this.value >= this.min : true)
      && (this.max !== undefined ? this.value <= this.max : true)
      && Number.isInteger(this.value);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof IntegerValue)) return false;
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

  static fromPrimitives<V extends IntegerValue = IntegerValue>(
    this: new (value: number, min?: number, max?: number) => V,
    value: number,
    min?: number,
    max?: number,
  ): V {
    return new this(value, min, max);
  }

  abstract readonly attributeName: string;
}
