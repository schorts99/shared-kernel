import { describe, it, expect } from "@jest/globals";
import { expectTypeOf } from "expect-type";

import { ValueObject, UUIDValue } from "../../src/value-objects";

class TestUUIDvalue extends UUIDValue {
  readonly attributeName = "test";
}

describe("UUIDValue", () => {
  it('should implement "ValueObject" interface', () => {
    expectTypeOf<UUIDValue>().toExtend<ValueObject>();
  });

  it('should have a "valueType" with "UUID" as value', () => {
    const testUUIDvalue = new TestUUIDvalue();

    expect(testUUIDvalue.valueType).toEqual("UUID");
  });

  it('should have a "value" property of type string | undefined', () => {
    expectTypeOf<UUIDValue["value"]>().toEqualTypeOf<string | undefined>();
  });

  it('should have a "optional" property of type boolean', () => {
    expectTypeOf<UUIDValue["optional"]>().toBeBoolean();
  });

  describe('when "value" is present', () => {
    describe('when "value" is valid', () => {
      it('should have a getter "isValid" that returns true', () => {
        const testUUIDvalue = new TestUUIDvalue("87a00bc1-c586-4d23-bfc7-dd637628777c");

        expect(testUUIDvalue.isValid).toBeTruthy();
      });
    });

    describe('when "value" is not valid', () => {
      it('should have a getter "isValid" that returns false', () => {
        const testUUIDvalue = new TestUUIDvalue("dummy-uuid-12346-5734");

        expect(testUUIDvalue.isValid).toBeFalsy();
      });
    });
  });

  describe('when "value" is not present', () => {
    describe('when "value" is optional', () => {
      it('should have a getter "isValid" that returns true', () => {
        const testUUIDvalue = new TestUUIDvalue(undefined, true);

        expect(testUUIDvalue.isValid).toBeTruthy();
      });
    });

    describe('when "value" is not optional', () => {
      it('should have a getter "isValid" that runs the validations normally and returns false', () => {
        const testUUIDvalue = new TestUUIDvalue(undefined, false);

        expect(testUUIDvalue.isValid).toBeFalsy();
      });
    });
  });
});
