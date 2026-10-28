import { ValueObject } from "./value-object";
import { cloneValue, deepEqual } from "../utils/object";
import {
  deepFreezeValue,
  ObjectSchema,
  validateObjectSchema,
} from "./schema-validation";

export type { ObjectSchema } from "./schema-validation";

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
      let cloned = value;
      try {
        cloned = cloneValue(value);
      } catch {
        cloned = value;
      }
      this.value = deepFreezeValue(cloned);
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

    return validateObjectSchema(this.value as Type, this.schema);
  }

  toString(): string {
    return JSON.stringify(this.value);
  }

  toJSON(): Optional extends true ? Type | null : Type {
    return this.value;
  }

  toPrimitives(): Optional extends true ? Type | null : Type {
    return this.value;
  }

  static fromPrimitives<V extends ObjectValue<any, any> = ObjectValue<any, any>>(
    this: new (...args: any[]) => V,
    ...args: any[]
  ): V {
    return new this(...args);
  }

  equals(valueObject: unknown): boolean {
    if (!(valueObject instanceof ObjectValue)) return false;
    if (!this.isValid || !valueObject.isValid) return false;

    return deepEqual(this.value, valueObject.value);
  }
}
