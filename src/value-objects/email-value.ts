import { ValueObject } from "./";

export abstract class EmailValue implements ValueObject {
  readonly valueType = "Email";
  private readonly REGEX =
    /^([A-Za-z0-9_\-\.])+\@(?!(?:[A-Za-z0-9_\-\.]+\.)?com\.com)([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  get isValid(): boolean {
    return this.REGEX.test(this.value);
  }

  abstract readonly attributeName: string;
}
