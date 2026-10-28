import type { ValueObject } from "./";

export abstract class URLValue implements ValueObject {
  readonly valueType = "URL";
  readonly value: URL;
  readonly allowedHosts: Array<string>;

  constructor(value: URL, allowedHosts: Array<string> = []) {
    this.value = value instanceof URL ? new URL(value.toString()) : value;
    this.allowedHosts = [...allowedHosts];
  }

  get isValid(): boolean {
    if (!(this.value instanceof URL) || !this.value.href) {
      return false;
    }
    return this.allowedHosts.length === 0 || this.allowedHosts.includes(this.value.hostname);
  }

  equals(valueObject: unknown): boolean {
    return (
      valueObject instanceof URLValue &&
      this.isValid &&
      valueObject.isValid &&
      this.value.href === valueObject.value.href
    );
  }

  toString(): string {
    return this.value instanceof URL ? this.value.toString() : String(this.value);
  }

  toJSON(): string {
    return this.toPrimitives();
  }

  toPrimitives(): string {
    return this.value instanceof URL ? this.value.toString() : String(this.value);
  }

  static fromPrimitives<V extends URLValue = URLValue>(
    this: new (value: URL, allowedHosts?: Array<string>) => V,
    value: URL | string,
    allowedHosts: Array<string> = [],
  ): V {
    return new this(value instanceof URL ? value : new URL(value), allowedHosts);
  }

  abstract readonly attributeName: string;
}
