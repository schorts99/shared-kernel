import { ValueObject } from "./value-object";

type DateInput<Required extends boolean> =
  Required extends true ? Date : Date | null;

export abstract class DateValue<Required extends boolean = true> implements ValueObject {
  readonly valueType = "Date";
  readonly value: DateInput<Required>;
  readonly beforeDate: Date | undefined;
  readonly afterDate: Date | undefined;
  private readonly optional: boolean;

  constructor(value: DateInput<Required>, beforeDate?: Date, afterDate?: Date, optional = false) {
    this.value = value;
    this.beforeDate = beforeDate;
    this.afterDate = afterDate;
    this.optional = optional;
  }

  get isValid(): boolean {
    if (!this.value) return this.optional;
    if (this.beforeDate && this.value > this.beforeDate) return false;
    if (this.afterDate && this.value < this.afterDate) return false;

    return true;
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof DateValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return this.value?.getTime() === valueObject.value?.getTime();
  }

  abstract readonly attributeName: string;
}
