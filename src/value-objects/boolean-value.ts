import { ValueObject } from "./";

export abstract class BooleanValue implements ValueObject {
  readonly valueType = "Boolean";
  readonly value: boolean;

  constructor(value: boolean) {
    this.value = value;
  }

  get isValid(): boolean {
    return true;
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof BooleanValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return this.value === valueObject.value;
  }

  toString(): string {
    return String(this.value);
  }

  toJSON(): boolean {
    return this.value;
  }

  toPrimitives(): boolean {
    return this.value;
  }

  static fromPrimitives<V extends BooleanValue = BooleanValue>(
    this: new (value: boolean) => V,
    value: boolean,
  ): V {
    return new this(value);
  }

  abstract readonly attributeName: string;
}
