import { ValueObject } from "./";

const REGEX = /^([A-Za-z0-9_\-\.])+\@(?!(?:[A-Za-z0-9_\-\.]+\.)?com\.com)([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;

export abstract class EmailValue implements ValueObject {
  readonly valueType = "Email";
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  get isValid(): boolean {
    return REGEX.test(this.value);
  }

  abstract readonly attributeName: string;
}
