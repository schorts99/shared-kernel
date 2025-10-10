import { ValueObject } from "./value-object";

export abstract class DateValue implements ValueObject {
  readonly valueType = "Date";
  readonly value: Date;
  readonly beforeDate: Date | undefined;
  readonly afterDate: Date | undefined;

  constructor(value: Date, beforeDate?: Date, afterDate?: Date) {
    this.value = value;
    this.beforeDate = beforeDate;
    this.afterDate = afterDate;
  }

  get isValid(): boolean {
    if (this.beforeDate && this.value > this.beforeDate) return false;
    if (this.afterDate && this.value < this.afterDate) return false;

    return true;
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof DateValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return this.value.getTime() === valueObject.value.getTime();
  }

  abstract readonly attributeName: string;
}
