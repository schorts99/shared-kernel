import { ValueObject } from './';

export abstract class EnumValue<Type extends string> implements ValueObject {
  readonly valueType = 'Enum';
  readonly allowedValues: Type[];
  readonly optional: boolean;
  readonly value: Type | null;

  constructor(allowedValues: Type[], value: Type | null, optional = false) {
    this.allowedValues = allowedValues;
    this.optional = optional;
    this.value = value;
  }

  get isValid(): boolean {
    if (this.optional && this.value === null) return true;
    if (!this.optional && this.value === null) return false;

    return this.allowedValues.includes(this.value as Type);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof EnumValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return this.value === valueObject.value;
  }

  abstract readonly attributeName: string;
}
