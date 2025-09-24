import { ValueObject } from "./";

export abstract class EnumValue implements ValueObject {
  readonly valueType = "Enum";
  readonly allowedValues: Array<string>;
  readonly value: typeof this.allowedValues[number] | string;

  constructor(allowedValues: Array<string>, value: string) {
    this.allowedValues = allowedValues;
    this.value = value;
  }

  get isValid(): boolean {
    return this.allowedValues.includes(this.value);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof EnumValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;
  
    return this.value === valueObject.value;
  }

  abstract readonly attributeName: string;
}
