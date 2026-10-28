import type { ValidationRule } from "../validators/index.js";

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

// Removed in 11.0. Rules built without type checking (JavaScript, JSON) could still use
// them, and an unrecognized rule passes, so fail loudly instead of accepting every value.
const REMOVED_RULES: Record<string, string> = {
  greater_than: "greaterThan",
  greater_than_or_equal: "greaterThanOrEqual",
  less_than: "lessThan",
  less_than_or_equal: "lessThanOrEqual",
};

export function validateSchemaRule(value: any, rule: ValidationRule<any>): boolean {
  for (const removed of Object.keys(REMOVED_RULES)) {
    if (removed in rule) {
      throw new TypeError(`Validation rule "${removed}" was removed in 11.0; use "${REMOVED_RULES[removed]}"`);
    }
  }
  if ("required" in rule) {
    return rule.required ? value !== undefined && value !== null : true;
  }
  if ("greaterThan" in rule) return typeof value === "number" && value > rule.greaterThan;
  if ("greaterThanOrEqual" in rule) return typeof value === "number" && value >= rule.greaterThanOrEqual;
  if ("lessThan" in rule) return typeof value === "number" && value < rule.lessThan;
  if ("lessThanOrEqual" in rule) return typeof value === "number" && value <= rule.lessThanOrEqual;
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
