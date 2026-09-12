export type ValidationRule<Type> =
  | { required: true }
  | { greaterThan: number }
  | { greaterThanOrEqual: number }
  | { lessThan: number }
  | { lessThanOrEqual: number }
  | { type: "string" | "number" | "boolean" }
  | { enum: ReadonlyArray<Type> }
  | { custom: (value: Type) => boolean };
