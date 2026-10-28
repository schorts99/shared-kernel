import { ValueObject } from "./";

export abstract class PathValue implements ValueObject<string> {
  readonly valueType = "Path";
  readonly value: string;
  readonly allowedRoots: string[];

  constructor(value: string, allowedRoots: string[] = []) {
    this.value = value;
    this.allowedRoots = allowedRoots;
  }

  get isValid(): boolean {
    if (!this.value || this.value.trim().length === 0) return false;

    const normalized = this.value.replace(/\\/g, "/");

    if (this.allowedRoots.length > 0) {
      return this.allowedRoots.some(root => normalized.startsWith(root));
    }

    return true;
  }

  equals(other: unknown): boolean {
    if (!(other instanceof PathValue)) return false;
    if (!this.isValid || !other.isValid) return false;

    const normalize = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");

    return normalize(this.value) === normalize(other.value);
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

  static fromPrimitives<V extends PathValue = PathValue>(
    this: new (value: string, allowedRoots?: string[]) => V,
    value: string,
    allowedRoots: string[] = [],
  ): V {
    return new this(value, allowedRoots);
  }

  abstract readonly attributeName: string;
}
