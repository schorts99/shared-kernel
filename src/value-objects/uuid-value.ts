import type { ValueObject } from "./";

const REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    return this.optional
            ? this.value
              ? REGEX.test(this.value)
              : true
            : REGEX.test(this.value!);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof UUIDValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;
  
    return this.value === valueObject.value;
  }

  abstract readonly attributeName: string;
}
