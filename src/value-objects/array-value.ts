import { ValueObject } from "./value-object";

type Primitive = string | number | boolean | null | undefined;

export type ValidationRule<Type> =
  | { required: true }
  | { greater_than: number }
  | { greater_than_or_equal: number }
  | { less_than: number }
  | { less_than_or_equal: number }
  | { type: "string" | "number" | "boolean" }
  | { enum: ReadonlyArray<Type> }
  | { custom: (value: Type) => boolean };

type ObjectSchema<Type> = {
  [Key in keyof Type]?: Type[Key] extends Primitive
    ? ValidationRule<Type[Key]>[]
    : ObjectSchema<Type[Key]>;
};

export abstract class ArrayValue<Type = any> implements ValueObject {
  readonly valueType = "Array";
  readonly value: Type[];
  readonly schema: ObjectSchema<Type> | ValidationRule<Type>[];
  abstract readonly attributeName: string;
  abstract readonly isPrimitive: boolean;

  constructor(
    value: Type[],
    schema: ObjectSchema<Type> | ValidationRule<Type>[],
  ) {
    this.value = this.deepFreeze(value);
    this.schema = schema;
  }

  get isValid(): boolean {
    return this.value.every((item) => {
      return this.isPrimitive
        ? (this.schema as ValidationRule<Type>[]).every(rule => this.validateRule(item, rule))
        : this.validateObject(item, this.schema as ObjectSchema<Type>);
    });
  }

  private validateObject(obj: any, schema: ObjectSchema<any>): boolean {
    return Object.entries(schema).every(([key, rulesOrNested]) => {
      const value = obj[key];

      if (Array.isArray(rulesOrNested)) {
        return rulesOrNested.every((rule) => this.validateRule(value, rule));
      }

      if (typeof rulesOrNested === "object" && value !== null && typeof value === "object") {
        return this.validateObject(value, rulesOrNested as ObjectSchema<any>);
      }

      return true;
    });
  }

  private validateRule(value: any, rule: ValidationRule<any>): boolean {
    if ("required" in rule) return value !== undefined && value !== null;
    if ("greater_than" in rule) return typeof value === "number" && value > rule.greater_than;
    if ("greater_than_or_equal" in rule) return typeof value === "number" && value >= rule.greater_than_or_equal;
    if ("less_than" in rule) return typeof value === "number" && value < rule.less_than;
    if ("less_than_or_equal" in rule) return typeof value === "number" && value <= rule.less_than_or_equal;
    if ("type" in rule) return typeof value === rule.type;
    if ("enum" in rule) return rule.enum.includes(value)
    if ("custom" in rule) return rule.custom(value);

    return true;
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof ArrayValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return JSON.stringify(this.value) === JSON.stringify(valueObject.value);
  }

  private deepFreeze<Type>(obj: Type): Type {
    if (Array.isArray(obj)) {
      obj.forEach(item => this.deepFreeze(item));
    } else if (obj && typeof obj === "object") {
      Object.getOwnPropertyNames(obj).forEach(prop => {
        const value = (obj as any)[prop];
        if (value && typeof value === "object") {
          this.deepFreeze(value);
        }
      });
    }
  
    return Object.freeze(obj);
  }
}
