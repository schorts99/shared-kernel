import { expectTypeOf } from "expect-type";

import { ValueObject, PhoneValue } from "../../src/value-objects";

class TestPhoneValue extends PhoneValue {
  readonly attributeName = "test";
}

describe("PhoneValue", () => {
  it('should implement "ValueObject" interface', () => {
    expectTypeOf<PhoneValue>().toExtend<ValueObject>();
  });

  it('should have a "valueType" with "Phone" as value', () => {
    const testPhoneValue = new TestPhoneValue("");

    expect(testPhoneValue.valueType).toEqual("Phone");
  });

  it('should have a "value" property of type string', () => {
    expectTypeOf<PhoneValue["value"]>().toBeString();
  });

  it('should have a "countryCode" property of type string', () => {
    expectTypeOf<PhoneValue["countryCode"]>().toEqualTypeOf<string | null>();
  });

  it('should have a "phoneNumber" property of type string', () => {
    expectTypeOf<PhoneValue["phoneNumber"]>().toEqualTypeOf<string | null>();
  });

  it('should have a "formattedPhone" property of type string', () => {
    expectTypeOf<PhoneValue["formattedPhone"]>().toEqualTypeOf<string | null>();
  });

  it('should define the "equals" method', () => {
    expectTypeOf<PhoneValue["equals"]>().toEqualTypeOf<(valueObject: unknown) => boolean>();
  });

  describe('when "value" is a phone', () => {
    const countryCode = "+52";
    const phoneNumber = "1234567890";
    const formattedPhone = `${countryCode} (123) 456-7890`;
    const testPhoneValue = new TestPhoneValue(`${countryCode}${phoneNumber}`);

    it('should return true the "isValid" getter', () => {
      expect(testPhoneValue.isValid).toBeTruthy();
    });

    it('should return the "countryCode" property', () => {
      expect(testPhoneValue.countryCode).toEqual(countryCode);
    });

    it('should return the "phoneNumber" property', () => {
      expect(testPhoneValue.phoneNumber).toEqual(phoneNumber);
    });

    it('should return the "formattedPhone" property', () => {
      expect(testPhoneValue.formattedPhone).toEqual(formattedPhone);
    });
  });

  describe('when "value" is not a phone', () => {
    const testPhoneValue = new TestPhoneValue("+112345678901241");

    it('should return false the "isValid" getter', () => {
      expect(testPhoneValue.isValid).toBeFalsy();
    });

    it('should return null for the "countryCode" property', () => {
      expect(testPhoneValue.countryCode).toBeNull();
    });

    it('should return null for the "phoneNumber" property', () => {
      expect(testPhoneValue.phoneNumber).toBeNull();
    });

    it('should return null for the "formattedPhone" property', () => {
      expect(testPhoneValue.formattedPhone).toBeNull();
    });
  });
});
