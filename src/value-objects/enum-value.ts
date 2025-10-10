import { ValueObject } from './';

export abstract class EnumValue<Type extends string | null> implements ValueObject {
  readonly valueType = 'Enum';
  readonly allowedValues: Type[];
  readonly value: Type;

  constructor(allowedValues: Type[], value: Type) {
    this.allowedValues = allowedValues;
    this.value = value;
  }

  get isValid(): boolean {
    return this.allowedValues.includes(this.value as Type);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof EnumValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return this.value === valueObject.value;
  }

  abstract readonly attributeName: string;
}
