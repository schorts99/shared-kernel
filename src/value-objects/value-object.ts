export interface ValueObject {
  readonly value: unknown;
  readonly valueType: string;
  readonly attributeName: string;
  isValid: boolean;
  equals(valueObject: unknown): boolean;
}
