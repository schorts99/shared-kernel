import { describe, it } from "@jest/globals";
import { expectTypeOf } from "expect-type";

import { ValueObject } from "../../src/value-objects";

describe("ValueObject", () => {
  it('should have a "value" property of type unknown', () => {
    expectTypeOf<ValueObject>().toHaveProperty("value");
    expectTypeOf<ValueObject['value']>().toBeUnknown();
  });

  it('should have a "isValid" property of type boolean', () => {
    expectTypeOf<ValueObject>().toHaveProperty("isValid");
    expectTypeOf<ValueObject['isValid']>().toBeBoolean();
  });

  it('should have a "valueType" property of type string', () => {
    expectTypeOf<ValueObject>().toHaveProperty("valueType");
    expectTypeOf<ValueObject['valueType']>().toBeString();
  });

  it('should have a "attributeName" property of type string', () => {
    expectTypeOf<ValueObject>().toHaveProperty("attributeName");
    expectTypeOf<ValueObject['attributeName']>().toBeString();
  });
});
