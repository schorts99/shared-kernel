import { describe, it, expect } from "@jest/globals";
import { expectTypeOf } from "expect-type";

import { ValueObject, StringValue } from "../../src/value-objects";

class TestStringalue extends StringValue {
  readonly attributeName = "test";
}

describe("StringValue", () => {
  it('should implement "ValueObject" interface', () => {
    expectTypeOf<TestStringalue>().toExtend<ValueObject>();
  });

  it('should have a "valueType" with "String" as value', () => {
    const testStringValue = new TestStringalue("");

    expect(testStringValue.valueType).toEqual("String");
  });

  it('should have a "value" property of type string', () => {
    expectTypeOf<StringValue["value"]>().toEqualTypeOf<string>();
  });

  it('should have a "minLength" property of type number', () => {
    expectTypeOf<StringValue["minLength"]>().toBeNumber();
  });

  it('should have a "maxLength" property of type number', () => {
    expectTypeOf<StringValue["maxLength"]>().toEqualTypeOf<number | undefined>()
  });

  describe('when "minLength" is not present', () => {
    it('should assign a default value of 0', () => {
      const testStringValue = new TestStringalue("");

      expect(testStringValue.minLength).toEqual(0);
    });

    it('should allow an empty string as valid', () => {
      const testStringValue = new TestStringalue("");

      expect(testStringValue.isValid).toBeTruthy();
    });
  });

  describe('when "minLength" is present', () => {
    it('should assign the provided value', () => {
      const minLength = 1;
      const testStringValue = new TestStringalue("", minLength);

      expect(testStringValue.minLength).toEqual(minLength);
    });

    it('should return false if the value provided length is less than the "minLength"', () => {
      const minLength = 1;
      const testStringValue = new TestStringalue("", minLength);

      expect(testStringValue.isValid).toBeFalsy();
    });

    it('should return true if the value provided length is greather or equal than the "minLength', () => {
      const minLength = 1;
      const testStringValue = new TestStringalue("1", minLength);

      expect(testStringValue.isValid).toBeTruthy();
    });
  });

  describe('when "maxLength" is not present', () => {
    it('should assign a default value of undefined', () => {
      const testStringValue = new TestStringalue("");

      expect(testStringValue.maxLength).toBeUndefined();
    });
  });

  describe('when "maxLength" is present', () => {
    it('should assign the provided value', () => {
      const maxLength = 1;
      const testStringValue = new TestStringalue("", 0, maxLength);

      expect(testStringValue.maxLength).toEqual(maxLength);
    });

    it('should return false if the value provided length is greather than the "maxLength"', () => {
      const maxLength = 1;
      const testStringValue = new TestStringalue("12", 0, maxLength);

      expect(testStringValue.isValid).toBeFalsy();
    });

    it('should return true if the value provided length is less or equal than the "maxLength', () => {
      const maxLength = 2;
      const testStringValue = new TestStringalue("1", 0, maxLength);

      expect(testStringValue.isValid).toBeTruthy();
    });
  });

  describe('when "minLength" and "maxLength" is present', () => {
    it('should return false if the value provided length is not between the "minLength" and "maxLength"', () => {
      const minLength = 1;
      const maxLength = 2;
      const testStringValue = new TestStringalue("123", minLength, maxLength);

      expect(testStringValue.isValid).toBeFalsy();
    });

    it('should return true if the value provided length is not between the "minLength" and "maxLength"', () => {
      const minLength = 1;
      const maxLength = 2;
      const testStringValue = new TestStringalue("12", minLength, maxLength);

      expect(testStringValue.isValid).toBeTruthy();
    });
  });
});
