import { expectTypeOf } from "expect-type";

import { ValueObject, EmailValue } from "../../src/value-objects";

class TestEmailValue extends EmailValue {
  readonly attributeName = "test";
}

describe("EmailValue", () => {
  it('should implement "ValueObject" interface', () => {
    expectTypeOf<EmailValue>().toExtend<ValueObject>();
  });

  it('should have a "valueType" with "Email" as value', () => {
    const testEmailValue = new TestEmailValue("");

    expect(testEmailValue.valueType).toEqual("Email");
  });

  it('should have a "value" property of type string', () => {
    expectTypeOf<EmailValue["value"]>().toBeString();
  });

  it('should define the "equals" method', () => {
    expectTypeOf<EmailValue["equals"]>().toEqualTypeOf<(valueObject: unknown) => boolean>();
  });

  describe('when "value" is an email', () => {
    it('should return true the "isValid" getter', () => {
      const testEmailValue = new TestEmailValue("test@example.com");

      expect(testEmailValue.isValid).toBeTruthy();
    });
  });

  describe('when "value" is not an email', () => {
    it('should return false the "isValid" getter', () => {
      const testEmailValue = new TestEmailValue("test@com");

      expect(testEmailValue.isValid).toBeFalsy();
    });
  });
});
