import {
  CoordinatesValue,
  DateValue,
  EmailValue,
  EnumValue,
  HTMLValue,
  MarkdownValue,
  PhoneValue,
  SlugValue,
  URLValue,
} from "../../src";

describe("Value object serialization and isolation", () => {
  it("isolate caller-owned inputs, serialize with toString/toJSON, and guard non-string values", () => {
    class TestEmailVO extends EmailValue {
      readonly attributeName = "email";
    }
    class TestPhoneVO extends PhoneValue {
      readonly attributeName = "phone";
    }
    class TestSlugVO extends SlugValue {
      readonly attributeName = "slug";
    }
    class TestEnumVO extends EnumValue<readonly ["draft", "published"]> {
      readonly attributeName = "status";
      constructor(val: "draft" | "published") {
        super(["draft", "published"] as const, val);
      }
    }
    class TestDateVO extends DateValue {
      readonly attributeName = "date";
    }
    class TestCoordsVO extends CoordinatesValue {
      readonly attributeName = "coords";
    }
    class TestUrlVO extends URLValue {
      readonly attributeName = "url";
    }
    class TestHtmlVO extends HTMLValue {
      readonly attributeName = "html";
    }
    class TestMarkdownVO extends MarkdownValue {
      readonly attributeName = "markdown";
    }

    const emailVo = new TestEmailVO("dev@example.com");
    const phoneVo = new TestPhoneVO("+14155552671");
    const slugVo = new TestSlugVO("my-slug");
    const enumVo = new TestEnumVO("published");
    const rawDate = new Date("2026-05-01T12:00:00.000Z");
    const dateVo = new TestDateVO(rawDate);
    const rawCoords = { latitude: 37.7749, longitude: -122.4194 };
    const coordsVo = new TestCoordsVO(rawCoords);
    const rawUrl = new URL("https://example.com/original");
    const urlVo = new TestUrlVO(rawUrl, ["example.com"]);

    // Mutate caller-owned Date, Coordinates object, and URL after construction
    rawDate.setUTCFullYear(1999);
    rawCoords.latitude = 0;
    rawUrl.pathname = "/mutated";

    expect(dateVo.toPrimitives()).toBe("2026-05-01T12:00:00.000Z");
    expect(coordsVo.latitude).toBe(37.7749);
    expect(urlVo.toPrimitives()).toBe("https://example.com/original");

    // Verify JSON.stringify and String() across all value objects
    expect(JSON.parse(JSON.stringify({ emailVo, phoneVo, slugVo, enumVo, dateVo, coordsVo, urlVo }))).toEqual({
      emailVo: "dev@example.com",
      phoneVo: "+14155552671",
      slugVo: "my-slug",
      enumVo: "published",
      dateVo: "2026-05-01T12:00:00.000Z",
      coordsVo: { latitude: 37.7749, longitude: -122.4194 },
      urlVo: "https://example.com/original",
    });
    expect(String(emailVo)).toBe("dev@example.com");
    expect(String(enumVo)).toBe("published");
    expect(String(urlVo)).toBe("https://example.com/original");

    // Verify non-string coercion guards and invalid Date/URL bounds
    expect(new TestEmailVO(["dev@example.com"] as unknown as string).isValid).toBe(false);
    expect(new TestPhoneVO(["+14155552671"] as unknown as string).isValid).toBe(false);
    expect(new TestSlugVO(["valid-slug"] as unknown as string).isValid).toBe(false);
    expect(new TestHtmlVO(["<p>hi</p>"] as unknown as string).isValid).toBe(false);
    expect(new TestMarkdownVO(["# title"] as unknown as string).isValid).toBe(false);
    expect(new TestUrlVO("https://example.com" as unknown as URL).isValid).toBe(false);
    expect(new TestDateVO(new Date("2026-05-01T00:00:00.000Z"), new Date("invalid")).isValid).toBe(false);
  });
});
