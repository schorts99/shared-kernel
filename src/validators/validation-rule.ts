export type ValidationRule<Type> =
  | { required: boolean }
  | { greaterThan: number }
  | { greaterThanOrEqual: number }
  | { lessThan: number }
  | { lessThanOrEqual: number }
  | { type: "string" | "number" | "boolean" }
  | { enum: ReadonlyArray<Type> }
  | { regex: RegExp }
  | { minLength: number }
  | { maxLength: number }
  | { custom: (value: Type) => boolean };
