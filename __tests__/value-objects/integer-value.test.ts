import { describe, it, expect } from "@jest/globals";
import { expectTypeOf } from "expect-type";

import { ValueObject, IntegerValue } from "../../src/value-objects";

class TestIntegerValue extends IntegerValue {
  readonly attributeName = "test";
}

describe("IntegerValue", () => {
  it('should implement "ValueObject" interface', () => {
    expectTypeOf<IntegerValue>().toExtend<ValueObject>();
  });

  it('should have a "valueType" with "Integer" as value', () => {
    const testIntegerValue = new TestIntegerValue(0);

    expect(testIntegerValue.valueType).toEqual("Integer");
  });

  it('should have a "value" property of type number', () => {
    expectTypeOf<IntegerValue["value"]>().toBeNumber();
  });

  it('should have a "min" property of type number or undefined', () => {
    expectTypeOf<IntegerValue["min"]>().toEqualTypeOf<number | undefined>();
  });

  it('should have a "max" property of type number or undefined', () => {
    expectTypeOf<IntegerValue["max"]>().toEqualTypeOf<number | undefined>()
  });

  it('should define the "equals" method', () => {
    expectTypeOf<IntegerValue["equals"]>().toEqualTypeOf<(valueObject: unknown) => boolean>();
  });

  describe('when "min" is not present', () => {
    it('should allow any negative integer as valid', () => {
      const testIntegerValue = new TestIntegerValue(-1);

      expect(testIntegerValue.isValid).toBeTruthy();
    });
  });

  describe('when "min" is present', () => {
    it('should assign the provided value', () => {
      const min = 1;
      const testIntegerValue = new TestIntegerValue(0, min);

      expect(testIntegerValue.min).toEqual(min);
    });

    it('should return false if the value provided is less than the "min"', () => {
      const min = 1;
      const testIntegerValue = new TestIntegerValue(-1, min);

      expect(testIntegerValue.isValid).toBeFalsy();
    });

    it('should return true if the value provided is greather or equal than the "min', () => {
      const min = 1;
      const testIntegerValue = new TestIntegerValue(1, min);

      expect(testIntegerValue.isValid).toBeTruthy();
    });
  });

  describe('when "max" is not present', () => {
    it('should assign a default value of undefined', () => {
      const testIntegerValue = new TestIntegerValue(0);

      expect(testIntegerValue.max).toBeUndefined();
    });
  });

  describe('when "max" is present', () => {
    it('should assign the provided value', () => {
      const max = 1;
      const testIntegerValue = new TestIntegerValue(0, undefined, max);

      expect(testIntegerValue.max).toEqual(max);
    });

    it('should return false if the value provided is greather than the "max"', () => {
      const max = 1;
      const testIntegerValue = new TestIntegerValue(2, undefined, max);

      expect(testIntegerValue.isValid).toBeFalsy();
    });

    it('should return true if the value provided is less or equal than the "max', () => {
      const max = 1;
      const testIntegerValue = new TestIntegerValue(1, undefined, max);

      expect(testIntegerValue.isValid).toBeTruthy();
    });
  });

  describe('when "min" and "max" is present', () => {
    it('should return false if the value provided is not between the "min" and "max"', () => {
      const min = -1;
      const max = 1;
      const testIntegerValue = new TestIntegerValue(2, min, max);

      expect(testIntegerValue.isValid).toBeFalsy();
    });

    it('should return true if the value provided is not between the "min" and "max"', () => {
      const min = -1;
      const max = 1;
      const testIntegerValue = new TestIntegerValue(0, min, max);

      expect(testIntegerValue.isValid).toBeTruthy();
    });
  });
});
