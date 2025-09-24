import { ValueObject } from "./";

export abstract class StringValue implements ValueObject {
  readonly valueType = "String";
  abstract readonly attributeName: string;
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
}
