import { ValueObject } from "./value-object.js";

export abstract class MarkdownValue implements ValueObject {
  readonly valueType = "MARKDOWN";
  readonly value: string;
  abstract readonly attributeName: string;

  constructor(value: string) {
    this.value = value;
  }

  get isValid(): boolean {
    return typeof this.value === "string" && /(^#|\*\*|_|`)/.test(this.value);
  }

  equals(other: unknown): boolean {
    if (!(other instanceof MarkdownValue)) return false;
    if (!this.isValid || !other.isValid) return false;

    return this.value.trim() === other.value.trim();
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  toPrimitives(): string {
    return this.value;
  }

  static fromPrimitives<V extends MarkdownValue = MarkdownValue>(
    this: new (value: string) => V,
    value: string,
  ): V {
    return new this(value);
  }
}
