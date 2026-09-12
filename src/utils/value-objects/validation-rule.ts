export type ValidationRule<Type> =
  | { required: true }
  | { greater_than: number }
  | { greater_than_or_equal: number }
  | { less_than: number }
  | { less_than_or_equal: number }
  | { type: "string" | "number" | "boolean" }
  | { enum: ReadonlyArray<Type> }
  | { custom: (value: Type) => boolean };
