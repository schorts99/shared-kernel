import { ValueObject } from "./";

export abstract class PathValue implements ValueObject<string> {
  readonly valueType = "Path";
  readonly value: string;
  readonly allowedRoots: string[];

  constructor(value: string, allowedRoots: string[] = []) {
    this.value = value;
    this.allowedRoots = allowedRoots;
  }

  private resolveNormalizedPath(rawPath: string): { path: string; escapedRoot: boolean } {
    const posix = rawPath.replace(/\\/g, "/");
    const isAbsolute = posix.startsWith("/");
    const parts = posix.split("/");
    const resolved: string[] = [];
    let escapedRoot = false;

    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (resolved.length > 0 && resolved[resolved.length - 1] !== "..") {
          resolved.pop();
        } else {
          escapedRoot = true;
          if (!isAbsolute) {
            resolved.push("..");
          }
        }
      } else {
        resolved.push(part);
      }
    }

    const joined = (isAbsolute ? "/" : "") + resolved.join("/");
    return { path: joined || (isAbsolute ? "/" : "."), escapedRoot };
  }

  get isValid(): boolean {
    if (typeof this.value !== "string" || this.value.trim().length === 0) return false;
    if (this.value.includes("\0")) return false;

    const { path: normalized, escapedRoot } = this.resolveNormalizedPath(this.value);
    if (escapedRoot) return false;

    if (this.allowedRoots.length > 0) {
      return this.allowedRoots.some(root => {
        const { path: normalizedRoot } = this.resolveNormalizedPath(root);
        if (normalizedRoot === "/") return normalized.startsWith("/");
        return (
          normalized === normalizedRoot ||
          normalized.startsWith(`${normalizedRoot}/`)
        );
      });
    }

    return true;
  }

  equals(other: unknown): boolean {
    if (!(other instanceof PathValue)) return false;
    if (!this.isValid || !other.isValid) return false;

    return (
      this.resolveNormalizedPath(this.value).path ===
      this.resolveNormalizedPath(other.value).path
    );
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
