import type { ValueObject } from "./";

export abstract class URLValue implements ValueObject {
  readonly valueType = "URL";
  readonly value: URL;
  readonly allowedHosts: Array<string>;

  constructor(value: URL, allowedHosts: Array<string> = []) {
    this.value = value;
    this.allowedHosts = allowedHosts;
  }

  get isValid(): boolean {
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

  toPrimitives(): string {
    return this.value.toString();
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
