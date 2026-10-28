import { ValueObject } from "./";

const REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export abstract class SlugValue implements ValueObject {
  readonly valueType = "Slug";
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  get isValid(): boolean {
    return REGEX.test(this.value);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof SlugValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;
  
    return this.value === valueObject.value;
  }

  toPrimitives(): string {
    return this.value;
  }

  static fromPrimitives<V extends SlugValue = SlugValue>(
    this: new (value: string) => V,
    value: string,
  ): V {
    return new this(value);
  }

  abstract readonly attributeName: string;
}
