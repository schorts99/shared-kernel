import type { ValueObject } from "./index.js";

const REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UUIDInput<Required extends boolean> =
  Required extends true ? string : string | null;

export abstract class UUIDValue<Required extends boolean = true> implements ValueObject {
  readonly valueType = "UUID";
  readonly value: UUIDInput<Required>;
  private readonly optional: boolean;

  constructor(value: UUIDInput<Required>, optional = false) {
    this.value = value;
    this.optional = optional;
  }

  get isValid(): boolean {
    if (this.optional && (this.value === null || this.value === undefined)) {
      return true;
    }
    return typeof this.value === "string" && REGEX.test(this.value);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof UUIDValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return (this.value?.toLowerCase() ?? null) === (valueObject.value?.toLowerCase() ?? null);
  }

  toString(): string {
    return String(this.value);
  }

  toJSON(): UUIDInput<Required> {
    return this.value;
  }

  toPrimitives(): UUIDInput<Required> {
    return this.value;
  }

  static fromPrimitives<V extends UUIDValue<any> = UUIDValue<any>>(
    this: new (value: any, optional?: boolean) => V,
    value: string | null,
    optional = false,
  ): V {
    return new this(value, optional);
  }

  abstract readonly attributeName: string;
}
