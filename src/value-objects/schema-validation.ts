import type { ValidationRule } from "../validators";

type Primitive = string | number | boolean | null | undefined;

export type ObjectSchema<Type> = {
  [Key in keyof Type]?: NonNullable<Type[Key]> extends Primitive
    ? ValidationRule<NonNullable<Type[Key]>>[]
    : NonNullable<Type[Key]> extends Primitive[]
      ? { _: ValidationRule<NonNullable<Type[Key]>[number]>[] }
      : NonNullable<Type[Key]> extends (infer U)[]
        ? { _: ObjectSchema<U> }
        : ObjectSchema<NonNullable<Type[Key]>>;
};

function isRuleRequired(rule: ValidationRule<any>): boolean {
  return "required" in rule && Boolean(rule.required);
}

export function validateSchemaRule(value: any, rule: ValidationRule<any>): boolean {
  if ("required" in rule) {
    return rule.required ? value !== undefined && value !== null : true;
  }
  if ("greaterThan" in rule || "greater_than" in rule) {
    return (
      typeof value === "number" &&
      ("greaterThan" in rule ? value > rule.greaterThan : value > rule.greater_than)
    );
  }
  if ("greaterThanOrEqual" in rule || "greater_than_or_equal" in rule) {
    return (
      typeof value === "number" &&
      ("greaterThanOrEqual" in rule
        ? value >= rule.greaterThanOrEqual
        : value >= rule.greater_than_or_equal)
    );
  }
  if ("lessThan" in rule || "less_than" in rule) {
    return (
      typeof value === "number" &&
      ("lessThan" in rule ? value < rule.lessThan : value < rule.less_than)
    );
  }
  if ("lessThanOrEqual" in rule || "less_than_or_equal" in rule) {
    return (
      typeof value === "number" &&
      ("lessThanOrEqual" in rule
        ? value <= rule.lessThanOrEqual
        : value <= rule.less_than_or_equal)
    );
  }
  if ("type" in rule) return typeof value === rule.type;
  if ("enum" in rule) return rule.enum.includes(value);
  if ("regex" in rule) return typeof value === "string" && rule.regex.test(value);
  if ("minLength" in rule) return typeof value === "string" && value.length >= rule.minLength;
  if ("maxLength" in rule) return typeof value === "string" && value.length <= rule.maxLength;
  if ("custom" in rule) return rule.custom(value);

  return true;
}

export function validateObjectSchema(obj: any, schema: ObjectSchema<any>): boolean {
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
        ? itemSchema.some((r) => isRuleRequired(r))
        : false;

      if (!isRequired && (value === undefined || value === null)) {
        return true;
      }

      if (!Array.isArray(value)) return false;

      if (Array.isArray(itemSchema)) {
        return value.every((item) =>
          itemSchema.every((rule) => validateSchemaRule(item, rule)),
        );
      }

      return value.every((item) =>
        validateObjectSchema(item, itemSchema as ObjectSchema<any>),
      );
    }

    if (Array.isArray(rulesOrNested)) {
      const isRequired = rulesOrNested.some((r) => isRuleRequired(r));

      if (!isRequired && (value === undefined || value === null)) {
        return true;
      }

      return rulesOrNested.every((rule) => validateSchemaRule(value, rule));
    }

    if (typeof rulesOrNested === "object" && rulesOrNested !== null) {
      if (value === undefined || value === null) {
        return true;
      }

      if (typeof value !== "object" || Array.isArray(value)) {
        return false;
      }

      return validateObjectSchema(value, rulesOrNested as ObjectSchema<any>);
    }

    return false;
  });
}

export function deepFreezeValue<T>(obj: T, seen: WeakSet<object> = new WeakSet()): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (seen.has(obj)) {
    return obj;
  }
  seen.add(obj);

  if (
    ArrayBuffer.isView(obj) ||
    obj instanceof ArrayBuffer ||
    (typeof SharedArrayBuffer !== "undefined" && obj instanceof SharedArrayBuffer)
  ) {
    return obj;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => deepFreezeValue(item, seen));
  } else if (!(obj instanceof Date) && !(obj instanceof RegExp) && !(obj instanceof Map) && !(obj instanceof Set)) {
    Object.getOwnPropertyNames(obj).forEach((prop) => {
      const value = (obj as any)[prop];
      if (value && typeof value === "object") {
        deepFreezeValue(value, seen);
      }
    });
  }

  return Object.freeze(obj);
}
