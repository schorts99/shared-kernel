import { expectTypeOf } from "expect-type";

import { ValueObject, SlugValue } from "../../src/value-objects";

class TestSlugValue extends SlugValue {
  readonly attributeName = "test";
}

describe("SlugValue", () => {
  it('should implement "ValueObject" interface', () => {
    expectTypeOf<TestSlugValue>().toExtend<ValueObject>();
  });

  it('should have a "valueType" with "Slug" as value', () => {
    const testSlugValue = new TestSlugValue("");

    expect(testSlugValue.valueType).toEqual("Slug");
  });

  it('should have a "value" property of type string', () => {
    expectTypeOf<SlugValue["value"]>().toBeString();
  });

  it('should define the "equals" method', () => {
    expectTypeOf<SlugValue["equals"]>().toEqualTypeOf<(valueObject: unknown) => boolean>();
  });

  describe('when "value" is an slug', () => {
    it('should return true the "isValid" getter', () => {
      const testSlugValue = new TestSlugValue("schorts");

      expect(testSlugValue.isValid).toBeTruthy();
    });
  });

  describe('when "value" is not an slug', () => {
    it('should return false the "isValid" getter', () => {
      const testSlugValue = new TestSlugValue("-schorts");

      expect(testSlugValue.isValid).toBeFalsy();
    });
  });
});
