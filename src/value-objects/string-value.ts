import { ValueObject } from "./";

export abstract class StringValue implements ValueObject {
  readonly valueType = "String";
  readonly value: string;
  readonly minLength: number;
  readonly maxLength: number | undefined;

  constructor(value: string, minLength = 0, maxLength?: number) {
    this.value = value;
    this.minLength = minLength;
    this.maxLength = maxLength;
  }

  get isValid(): boolean {
    return this.value.length >= this.minLength && (this.maxLength ? this.value.length <= this.maxLength : true);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof StringValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;
  
    return this.value === valueObject.value;
  }

  abstract readonly attributeName: string;
}
