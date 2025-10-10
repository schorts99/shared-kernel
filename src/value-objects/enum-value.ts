import { ValueObject } from "./value-object";

export abstract class EnumValue<Allowed extends readonly (string | null)[]> implements ValueObject {
  readonly valueType = 'Enum';
  readonly allowedValues: Allowed;
  readonly value: Allowed[number];

  constructor(allowedValues: Allowed, value: Allowed[number]) {
    this.allowedValues = allowedValues;
    this.value = value;
  }

  get isValid(): boolean {
    return this.allowedValues.includes(this.value);
  }

  equals(valueObject: unknown): boolean {
    return (
      valueObject instanceof EnumValue &&
      this.isValid &&
      valueObject.isValid &&
      this.value === valueObject.value
    );
  }

  abstract readonly attributeName: string;
}
