export interface ValueObject<T = any> {
  readonly value: T;
  readonly valueType: string;
  readonly attributeName: string;
  readonly isValid: boolean;

  equals(other: unknown): boolean;

  toString?(): string;

  toJSON?(): T;
}
