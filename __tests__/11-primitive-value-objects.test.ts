import {
  BooleanValue,
  IntegerValue,
  PhoneValue,
} from "../src";

class QuantityValue extends IntegerValue {
  readonly attributeName = "quantity";

  constructor(value: number) {
    super(value, 1, 10);
  }
}

class UnboundedIntegerValue extends IntegerValue {
  readonly attributeName = "count";
}

class ContactPhoneValue extends PhoneValue {
  readonly attributeName = "phone";
}

class ActiveValue extends BooleanValue {
  readonly attributeName = "active";
}

describe("IntegerValue", () => {
  it("validates integers against optional bounds", () => {
    expect(new QuantityValue(1).isValid).toBe(true);
    expect(new QuantityValue(10).isValid).toBe(true);
    expect(new QuantityValue(0).isValid).toBe(false);
    expect(new QuantityValue(11).isValid).toBe(false);
    expect(new QuantityValue(2.5).isValid).toBe(false);
    expect(new UnboundedIntegerValue(-1_000_000).isValid).toBe(true);
    expect(new UnboundedIntegerValue(Number.NaN).isValid).toBe(false);
  });

  it("compares only valid integer values", () => {
    expect(new QuantityValue(3).equals(new QuantityValue(3))).toBe(true);
    expect(new QuantityValue(3).equals(new UnboundedIntegerValue(3))).toBe(true);
    expect(new QuantityValue(3).equals(new QuantityValue(4))).toBe(false);
    expect(new QuantityValue(20).equals(new QuantityValue(20))).toBe(false);
    expect(new QuantityValue(3).equals(3)).toBe(false);
  });

  it("serializes and round-trips through primitives", () => {
    const value = new UnboundedIntegerValue(42, 0, 100);

    expect(value.toString()).toBe("42");
    expect(value.toJSON()).toBe(42);
    expect(JSON.stringify({ value })).toBe('{"value":42}');
    expect(value.toPrimitives()).toBe(42);

    const restored = UnboundedIntegerValue.fromPrimitives(42, 0, 100);
    expect(restored).toBeInstanceOf(UnboundedIntegerValue);
    expect(restored.min).toBe(0);
    expect(restored.max).toBe(100);
    expect(restored.equals(value)).toBe(true);
  });
});

describe("PhoneValue", () => {
  it("validates E.164-style numbers", () => {
    expect(new ContactPhoneValue("+525512345678").isValid).toBe(true);
    expect(new ContactPhoneValue("+15551234567").isValid).toBe(true);
    expect(new ContactPhoneValue("525512345678").isValid).toBe(false);
    expect(new ContactPhoneValue("+52 55 1234 5678").isValid).toBe(false);
    expect(new ContactPhoneValue("+52551234567890123").isValid).toBe(false);
    expect(new ContactPhoneValue(5551234567 as unknown as string).isValid).toBe(false);
  });

  it("splits valid numbers into country code, number, and formatted output", () => {
    const phone = new ContactPhoneValue("+525512345678");

    expect(phone.countryCode).toBe("+52");
    expect(phone.phoneNumber).toBe("5512345678");
    expect(phone.formattedPhone).toBe("+52 (551) 234-5678");
  });

  it("returns null parts for invalid numbers", () => {
    const phone = new ContactPhoneValue("not-a-phone");

    expect(phone.countryCode).toBeNull();
    expect(phone.phoneNumber).toBeNull();
    expect(phone.formattedPhone).toBeNull();
  });

  it("compares, serializes, and round-trips valid numbers", () => {
    const phone = new ContactPhoneValue("+525512345678");

    expect(phone.equals(new ContactPhoneValue("+525512345678"))).toBe(true);
    expect(phone.equals(new ContactPhoneValue("+525512345679"))).toBe(false);
    expect(new ContactPhoneValue("bad").equals(new ContactPhoneValue("bad"))).toBe(false);
    expect(phone.equals("+525512345678")).toBe(false);
    expect(phone.toString()).toBe("+525512345678");
    expect(phone.toJSON()).toBe("+525512345678");
    expect(ContactPhoneValue.fromPrimitives(phone.toPrimitives()).equals(phone)).toBe(true);
  });
});

describe("BooleanValue", () => {
  it("accepts only boolean values", () => {
    expect(new ActiveValue(true).isValid).toBe(true);
    expect(new ActiveValue(false).isValid).toBe(true);
    expect(new ActiveValue("true" as unknown as boolean).isValid).toBe(false);
  });

  it("compares, serializes, and round-trips values", () => {
    const active = new ActiveValue(false);

    expect(active.equals(new ActiveValue(false))).toBe(true);
    expect(active.equals(new ActiveValue(true))).toBe(false);
    expect(active.equals(false)).toBe(false);
    expect(new ActiveValue(1 as unknown as boolean).equals(new ActiveValue(1 as unknown as boolean))).toBe(false);
    expect(active.toString()).toBe("false");
    expect(active.toJSON()).toBe(false);
    expect(ActiveValue.fromPrimitives(active.toPrimitives()).equals(active)).toBe(true);
  });
});
