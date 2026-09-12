export type ValidationRule<Type> =
  | { required: true }
  /** @deprecated Use `{ greaterThan: number }` instead */
  | { greater_than: number }
  | { greaterThan: number }
  /** @deprecated Use `{ greaterThanOrEqual: number }` instead */
  | { greater_than_or_equal: number }
  | { greaterThanOrEqual: number }
  /** @deprecated Use `{ lessThan: number }` instead */
  | { less_than: number }
  | { lessThan: number }
  /** @deprecated Use `{ lessThanOrEqual: number }` instead */
  | { less_than_or_equal: number }
  | { lessThanOrEqual: number }
  | { type: "string" | "number" | "boolean" }
  | { enum: ReadonlyArray<Type> }
  | { regex: RegExp }
  | { minLength: number }
  | { maxLength: number }
  | { custom: (value: Type) => boolean };
