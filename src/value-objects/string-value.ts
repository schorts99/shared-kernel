import { ValueObject } from "./";

export abstract class StringValue<Optional extends boolean = false> implements ValueObject {
  readonly valueType = "String";
  readonly value: Optional extends true ? string | null : string;
  readonly minLength: number;
  readonly maxLength: number | undefined;
  readonly optional: Optional;

  constructor(
    value: Optional extends true ? string | null : string,
    minLength = 0,
    maxLength?: number,
    optional: Optional = false as Optional
  ) {
    this.value = value;
    this.minLength = minLength;
    this.maxLength = maxLength;
    this.optional = optional;
  }

  get isValid(): boolean {
    if (this.optional && this.value === null) {
      return true;
    }

    if (this.value === null) {
      return false;
    }

    const length = this.value.length;

    return length >= this.minLength && (this.maxLength ? length <= this.maxLength : true);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof StringValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return this.value === valueObject.value;
  }

  abstract readonly attributeName: string;
}
