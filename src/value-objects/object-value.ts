import { ValueObject } from "./value-object";
import type { ValidationRule } from "../validators";

type Primitive = string | number | boolean | null | undefined;

export type ObjectSchema<Type> = {
  [Key in keyof Type]?: Type[Key] extends Primitive
    ? ValidationRule<Type[Key]>[]
    : Type[Key] extends Primitive[]
      ? { _: ValidationRule<Type[Key][number]>[] }
      : Type[Key] extends (infer U)[]
        ? { _: ObjectSchema<U> }
        : ObjectSchema<Type[Key]>;
};

export abstract class ObjectValue<Type = any, Optional extends boolean = false> implements ValueObject {
  readonly valueType = "Object";
  readonly value: Optional extends true ? Type | null : Type;
  readonly schema: ObjectSchema<Type>;
  readonly optional: Optional;
  abstract readonly attributeName: string;

  constructor(value: Optional extends true ? Type | null : Type, schema: ObjectSchema<Type>, optional: Optional = false as Optional) {
    this.optional = optional;
    this.schema = schema;

    if (optional && value === null) {
      this.value = null as any;
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      this.value = this.deepFreeze(value);
    } else {
      this.value = value as any;
    }
  }

  get isValid(): boolean {
    if (this.optional && this.value === null) return true;
    if (this.value === null) return false;

    if (typeof this.value !== "object" || Array.isArray(this.value)) {
      return false;
    }

    return this.validateObject(this.value as Type, this.schema);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof ObjectValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return JSON.stringify(this.value) === JSON.stringify(valueObject.value);
  }

  private validateObject(obj: any, schema: ObjectSchema<any>): boolean {
    return Object.entries(schema).every(([key, rulesOrNested]) => {
      const value = obj[key];

      if (
        typeof rulesOrNested === "object" &&
        !Array.isArray(rulesOrNested) &&
        rulesOrNested !== null &&
        "_" in rulesOrNested
      ) {
        const itemSchema = rulesOrNested._;
        const isRequired = Array.isArray(itemSchema)
          ? itemSchema.some((r) => "required" in r)
          : false;

        if (!isRequired && (value === undefined || value === null)) {
          return true;
        }

        if (!Array.isArray(value)) return false;

        if (Array.isArray(itemSchema)) {
          return value.every((item) =>
            itemSchema.every((rule) => this.validateRule(item, rule)),
          );
        }

        return value.every((item) =>
          this.validateObject(item, itemSchema as ObjectSchema<any>),
        );
      }

      if (Array.isArray(rulesOrNested)) {
        const isRequired = rulesOrNested.some((r) => "required" in r);

        if (!isRequired && (value === undefined || value === null)) {
          return true;
        }

        return rulesOrNested.every((rule) => this.validateRule(value, rule));
      }

      if (typeof rulesOrNested === "object" && rulesOrNested !== null) {
        if (value === undefined || value === null) {
          return true;
        }

        if (typeof value !== "object" || Array.isArray(value)) {
          return false;
        }

        return this.validateObject(value, rulesOrNested as ObjectSchema<any>);
      }

      return false;
    });
  }

  private validateRule(value: any, rule: ValidationRule<any>): boolean {
    if ("required" in rule) return value !== undefined && value !== null;
    if ("greaterThan" in rule || "greater_than" in rule) return typeof value === "number" && ("greaterThan" in rule ? value > rule.greaterThan : value > rule.greater_than);
    if ("greaterThanOrEqual" in rule || "greater_than_or_equal" in rule) return typeof value === "number" && ("greaterThanOrEqual" in rule ? value >= rule.greaterThanOrEqual : value >= rule.greater_than_or_equal);
    if ("lessThan" in rule || "less_than" in rule) return typeof value === "number" && ("lessThan" in rule ? value < rule.lessThan : value < rule.less_than);
    if ("lessThanOrEqual" in rule || "less_than_or_equal" in rule) return typeof value === "number" && ("lessThanOrEqual" in rule ? value <= rule.lessThanOrEqual : value <= rule.less_than_or_equal);
    if ("type" in rule) return typeof value === rule.type;
    if ("enum" in rule) return rule.enum.includes(value);
    if ("regex" in rule) return typeof value === "string" && rule.regex.test(value);
    if ("minLength" in rule) return typeof value === "string" && value.length >= rule.minLength;
    if ("maxLength" in rule) return typeof value === "string" && value.length <= rule.maxLength;
    if ("custom" in rule) return rule.custom(value);

    return true;
  }

  private deepFreeze<T>(obj: T): T {
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
