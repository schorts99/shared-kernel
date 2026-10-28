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

    if (typeof this.value !== "string") {
      return false;
    }

    const length = this.value.length;

    return (
      length >= this.minLength &&
      (this.maxLength !== undefined ? length <= this.maxLength : true)
    );
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof StringValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return this.value === valueObject.value;
  }

  toString(): string {
    return String(this.value);
  }

  toJSON(): Optional extends true ? string | null : string {
    return this.value;
  }

  toPrimitives(): Optional extends true ? string | null : string {
    return this.value;
  }

  static fromPrimitives<V extends StringValue<any> = StringValue<any>>(
    this: new (value: any, minLength?: number, maxLength?: number, optional?: any) => V,
    value: string | null,
    minLength = 0,
    maxLength?: number,
    optional = false,
  ): V {
    return new this(value, minLength, maxLength, optional);
  }

  abstract readonly attributeName: string;
}
