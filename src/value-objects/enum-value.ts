import { ValueObject } from "./";

export abstract class EnumValue implements ValueObject {
  readonly valueType = "Enum";
  readonly allowedValues: Array<string>;
  readonly value: string;

  constructor(allowedValues: Array<string>, value: string) {
    this.allowedValues = allowedValues;
    this.value = value;
  }

  get isValid(): boolean {
    return this.allowedValues.includes(this.value);
  }

  abstract readonly attributeName: string;
}
