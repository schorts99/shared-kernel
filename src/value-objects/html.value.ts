import { ValueObject } from './value-object'

export abstract class HTMLValue implements ValueObject {
  readonly valueType = "HTML";
  readonly value: string;
  abstract readonly attributeName: string;

  constructor(value: string) {
    this.value = value;
  }

  get isValid(): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(this.value);
  }

  equals(other: unknown): boolean {
    if (!(other instanceof HTMLValue)) return false;
    if (!this.isValid || !other.isValid) return false;

    return this.value.trim() === other.value.trim();
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

