import {
  deepFreezeValue,
  validateObjectSchema,
  validateSchemaRule,
} from "../../src/value-objects/schema-validation";

describe("validateSchemaRule", () => {
  it.each([
    [{ required: true }, "x", true],
    [{ required: true }, null, false],
    [{ required: true }, undefined, false],
    [{ required: false }, undefined, true],
    [{ greaterThan: 5 }, 6, true],
    [{ greaterThan: 5 }, 5, false],
    [{ greater_than: 5 }, 6, true],
    [{ greaterThan: 5 }, "6", false],
    [{ greaterThanOrEqual: 5 }, 5, true],
    [{ greater_than_or_equal: 5 }, 4, false],
    [{ lessThan: 5 }, 4, true],
    [{ less_than: 5 }, 5, false],
    [{ lessThanOrEqual: 5 }, 5, true],
    [{ less_than_or_equal: 5 }, 6, false],
    [{ lessThan: 5 }, null, false],
    [{ type: "string" }, "x", true],
    [{ type: "number" }, "1", false],
    [{ enum: ["a", "b"] }, "a", true],
    [{ enum: ["a", "b"] }, "c", false],
    [{ regex: /^\d+$/ }, "123", true],
    [{ regex: /^\d+$/ }, 123, false],
    [{ minLength: 2 }, "ab", true],
    [{ minLength: 2 }, "a", false],
    [{ maxLength: 2 }, "ab", true],
    [{ maxLength: 2 }, "abc", false],
    [{ maxLength: 2 }, ["a"], false],
    [{ custom: (v: unknown) => v === 42 }, 42, true],
    [{ custom: (v: unknown) => v === 42 }, 41, false],
  ])("%j on %p is %p", (rule, value, expected) => {
    expect(validateSchemaRule(value, rule as never)).toBe(expected);
  });

  it("accepts any value for an unknown rule shape", () => {
    expect(validateSchemaRule("anything", {} as never)).toBe(true);
  });
});

describe("validateObjectSchema", () => {
  const schema = {
    name: [{ required: true }, { type: "string" }, { minLength: 1 }],
    age: [{ type: "number" }, { greaterThanOrEqual: 0 }],
    tags: { _: [{ type: "string" }] },
    codes: { _: [{ required: true }, { regex: /^[A-Z]{2}$/ }] },
    address: { city: [{ required: true }, { type: "string" }] },
    items: { _: { sku: [{ required: true }, { type: "string" }] } },
  };

  const valid = { name: "Ada", age: 36, tags: ["x"], codes: ["AB"], address: { city: "London" }, items: [{ sku: "a-1" }] };

  it("accepts a fully valid object", () => {
    expect(validateObjectSchema(valid, schema as never)).toBe(true);
  });

  it("skips optional fields, optional arrays, and missing nested objects", () => {
    expect(validateObjectSchema({ name: "Ada", codes: ["AB"] }, schema as never)).toBe(true);
    expect(validateObjectSchema({ ...valid, age: null, tags: null, address: undefined, items: undefined }, schema as never)).toBe(true);
  });

  it.each([
    ["a missing required field", { ...valid, name: undefined }],
    ["a failing rule on an optional field", { ...valid, age: -1 }],
    ["a required array that is missing", { ...valid, codes: undefined }],
    ["a non-array where an array is expected", { ...valid, tags: "x" }],
    ["an invalid primitive array item", { ...valid, codes: ["AB", "abc"] }],
    ["an invalid object array item", { ...valid, items: [{ sku: "a-1" }, { sku: 2 }] }],
    ["a non-object nested value", { ...valid, address: "London" }],
    ["an array nested value", { ...valid, address: ["London"] }],
    ["an invalid nested field", { ...valid, address: { city: 1 } }],
  ])("rejects %s", (_label, value) => {
    expect(validateObjectSchema(value, schema as never)).toBe(false);
  });

  it("rejects a schema entry that is not rules or a nested schema", () => {
    expect(validateObjectSchema({ name: "Ada" }, { name: "not a rule" } as never)).toBe(false);
  });
});

describe("deepFreezeValue", () => {
  it("freezes nested objects and arrays and handles cycles", () => {
    const value: Record<string, unknown> = { nested: { list: [{ n: 1 }] } };
    value.self = value;

    const frozen = deepFreezeValue(value);
    const nested = frozen.nested as { list: Array<{ n: number }> };

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(nested)).toBe(true);
    expect(Object.isFrozen(nested.list)).toBe(true);
    expect(Object.isFrozen(nested.list[0])).toBe(true);
  });

  it("leaves primitives and binary buffers alone and does not walk built-in containers", () => {
    const bytes = new Uint8Array([1, 2]);
    const buffer = new ArrayBuffer(4);
    const map = new Map([["k", { inner: true }]]);
    const date = new Date();

    expect(deepFreezeValue(5)).toBe(5);
    expect(deepFreezeValue(null)).toBeNull();
    expect(Object.isFrozen(deepFreezeValue(bytes))).toBe(false);
    expect(Object.isFrozen(deepFreezeValue(buffer))).toBe(false);

    const frozenWrapper = deepFreezeValue({ map, date });
    expect(Object.isFrozen(frozenWrapper)).toBe(true);
    expect(Object.isFrozen(map.get("k"))).toBe(false);
  });
});
