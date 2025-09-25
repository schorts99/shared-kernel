import { describe, it, expect } from "@jest/globals";
import { expectTypeOf } from "expect-type";

import { ValueObject, EnumValue } from "../../src/value-objects";

class TestEnumValue extends EnumValue {
  readonly attributeName = "test";
}

describe("EnumValue", () => {
  it('should implement "ValueObject" interface', () => {
    expectTypeOf<TestEnumValue>().toExtend<ValueObject>();
  });

  it('should have a "valueType" with "Enum" as value', () => {
    const testEnumValue = new TestEnumValue([], "");

    expect(testEnumValue.valueType).toEqual("Enum");
  });

  it('should have a "value" property of type string', () => {
    expectTypeOf<EnumValue["value"]>().toBeString();
  });

  it('should have a "allowedValues" property of type string[]', () => {
    expectTypeOf<EnumValue["allowedValues"]>().toBeArray();
  });

  it('should have a "allowedTypes" property of type string', () => {
    expectTypeOf<EnumValue["attributeName"]>().toBeString;
  });

  it('should define the "equals" method', () => {
    expectTypeOf<EnumValue["equals"]>().toEqualTypeOf<(valueObject: unknown) => boolean>();
  });

  describe('when value is in the "allowedTypes" property', () => {
    it('should return true on the "isValid" getter', () => {
      const testEnumValue = new TestEnumValue(["test"], "test");

      expect(testEnumValue.isValid).toBeTruthy();
    });
  });

  describe('when value is not in the "allowedTypes" property', () => {
    it('should return true on the "isValid" getter', () => {
      const testEnumValue = new TestEnumValue(["test"], "test2");

      expect(testEnumValue.isValid).toBeFalsy();
    });
  });
});
