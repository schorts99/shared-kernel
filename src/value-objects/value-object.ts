export interface ValueObject {
  value: unknown;
  isValid: boolean;
  valueType: string;
  attributeName: string;
}
