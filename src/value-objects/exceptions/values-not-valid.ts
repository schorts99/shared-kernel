import type { ValueNotValid } from "./value-not-valid";

export class ValuesNotValid extends Error {
  readonly errors: Array<ValueNotValid>;

  constructor(errors: Array<ValueNotValid>) {
    super();

    this.errors = errors;
  }
}
