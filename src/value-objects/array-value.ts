import { ValueObject } from "./value-object";
import type { ValidationRule } from "../validators";
import { deepEqual } from "../utils/object";
import {
  deepFreezeValue,
  ObjectSchema,
  validateObjectSchema,
  validateSchemaRule,
} from "./schema-validation";

export type { ObjectSchema } from "./schema-validation";

export abstract class ArrayValue<Type = any> implements ValueObject {
  readonly valueType = "Array";
  readonly value: Type[];
  readonly schema: ObjectSchema<Type> | ValidationRule<Type>[];

  toString(): string {
    return JSON.stringify(this.value);
  }

  toJSON(): Type[] {
    return this.value;
  }

  toPrimitives(): Type[] {
    return this.value;
  }

  static fromPrimitives<V extends ArrayValue<any> = ArrayValue<any>>(
    this: new (...args: any[]) => V,
    ...args: any[]
  ): V {
    return new this(...args);
  }

  abstract readonly attributeName: string;

  abstract readonly isPrimitive: boolean;

  constructor(
    value: Type[],
    schema: ObjectSchema<Type> | ValidationRule<Type>[],
  ) {
    this.value = Array.isArray(value) ? deepFreezeValue(value) : value;
    this.schema = schema;
  }

  get isValid(): boolean {
    if (!Array.isArray(this.value)) return false;

    return this.value.every((item) => {
      if (this.isPrimitive) {
        return (this.schema as ValidationRule<Type>[]).every((rule) =>
          validateSchemaRule(item, rule),
        );
      }

      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        return false;
      }

      return validateObjectSchema(item, this.schema as ObjectSchema<Type>);
    });
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof ArrayValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return deepEqual(this.value, valueObject.value);
  }
}
