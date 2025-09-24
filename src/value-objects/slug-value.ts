import { ValueObject } from "./";

const REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export abstract class SlugValue implements ValueObject {
  readonly valueType = "Slug";
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  get isValid(): boolean {
    return REGEX.test(this.value);
  }

  abstract readonly attributeName: string;
}
