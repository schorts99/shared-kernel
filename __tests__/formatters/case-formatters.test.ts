import {
  PascalCamelToSnake,
  SnakeToCamel,
} from "../../src";

describe("Case formatters", () => {
  it("preserve Dates when converting object keys", () => {
    const timestamp = new Date("2026-05-01T12:00:00.000Z");
    const snakeFormatted = PascalCamelToSnake.formatObject({
      userId: "u-1",
      createdAt: timestamp,
      nestedProfile: { firstName: "Ada" },
    });
    expect(snakeFormatted).toEqual({
      user_id: "u-1",
      created_at: timestamp,
      nested_profile: { first_name: "Ada" },
    });
    expect((snakeFormatted as any).created_at).toBeInstanceOf(Date);

    const camelFormatted = SnakeToCamel.formatObject(snakeFormatted);
    expect(camelFormatted).toEqual({
      userId: "u-1",
      createdAt: timestamp,
      nestedProfile: { firstName: "Ada" },
    });
    expect(camelFormatted.createdAt).toBeInstanceOf(Date);
  });

  it("handle uppercase and repeated underscores and circular references", () => {
    expect(SnakeToCamel.format("USER_NAME")).toBe("userName");
    expect(SnakeToCamel.format("first__name")).toBe("firstName");
    expect(SnakeToCamel.format("alreadyCamel")).toBe("alreadyCamel");

    const circularSnake: Record<string, any> = { first_name: "Alan" };
    circularSnake.self_ref = circularSnake;
    const formattedCamel = SnakeToCamel.formatObject(circularSnake);
    expect(formattedCamel.firstName).toBe("Alan");
    expect(formattedCamel.selfRef).toBe(formattedCamel);

    const formattedBackToSnake = PascalCamelToSnake.formatObject(formattedCamel);
    expect(formattedBackToSnake.first_name).toBe("Alan");
    expect(formattedBackToSnake.self_ref).toBe(formattedBackToSnake);
  });
});
