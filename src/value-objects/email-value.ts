import { ValueObject } from "./";

const REGEX = /^([A-Za-z0-9_\-\.])+\@(?!(?:[A-Za-z0-9_\-\.]+\.)?com\.com)([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;

export abstract class EmailValue implements ValueObject {
  readonly valueType = "Email";
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  get isValid(): boolean {
    return REGEX.test(this.value);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof EmailValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;
  
    return this.value === valueObject.value;
  }

  toPrimitives(): string {
    return this.value;
  }

  static fromPrimitives<V extends EmailValue = EmailValue>(
    this: new (value: string) => V,
    value: string,
  ): V {
    return new this(value);
  }

  abstract readonly attributeName: string;
}
