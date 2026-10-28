import {
  ValuesNotValid,
} from "../../src";

describe("ValuesNotValid", () => {
  it("builds its message and name from invalid values", () => {
    const invalidErr = new ValuesNotValid([
      Object.assign(new Error("Must be valid email"), { attributeName: "email" }),
      Object.assign(new Error(""), { attributeName: "age" }),
    ]);
    expect(invalidErr.name).toBe("ValuesNotValid");
    expect(invalidErr.message).toBe("Invalid values: email (Must be valid email), age");
  });
});
