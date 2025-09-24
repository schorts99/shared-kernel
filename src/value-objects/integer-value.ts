import { ValueObject } from "./";

export abstract class IntegerValue implements ValueObject {
  readonly valueType = "Integer";
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly value: number;

  constructor(value: number, min?: number, max?: number) {
    this.min = min;
    this.max = max;
    this.value = value;
  }

  get isValid(): boolean {
    return (this.min ? this.value >= this.min : true)
      && (this.max ? this.value <= this.max : true)
      && Number.isInteger(this.value);
  }

  abstract readonly attributeName: string;
}
