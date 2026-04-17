import { ValueObject } from "./value-object";

export abstract class BaseValueObject<T> implements ValueObject<T> {
  abstract readonly valueType: string;
  abstract readonly attributeName: string;
  readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  abstract get isValid(): boolean;

  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof BaseValueObject)) return false;
    if (this.valueType !== other.valueType) return false;
    if (!this.isValid || !other.isValid) return false;

    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }

  toJSON(): T {
    return this.value;
  }
}
