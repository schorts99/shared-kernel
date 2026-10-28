import type { ValueNotValid } from "./value-not-valid.js";

export class ValuesNotValid extends Error {
  readonly errors: Array<ValueNotValid>;

  constructor(errors: Array<ValueNotValid>, message?: string) {
    const details = errors
      .map(err => (err.message ? `${err.attributeName} (${err.message})` : err.attributeName))
      .join(", ");
    super(message ?? (details ? `Invalid values: ${details}` : "Values are not valid"));

    this.name = "ValuesNotValid";
    this.errors = errors;
  }
}
