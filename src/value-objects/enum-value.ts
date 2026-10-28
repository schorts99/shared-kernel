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

  toString(): string {
    return String(this.value);
  }

  toJSON(): Allowed[number] {
    return this.value;
  }

  toPrimitives(): Allowed[number] {
    return this.value;
  }

  static fromPrimitives<V extends EnumValue<any> = EnumValue<any>>(
    this: new (...args: any[]) => V,
    ...args: any[]
  ): V {
    return new this(...args);
  }

  abstract readonly attributeName: string;
}
