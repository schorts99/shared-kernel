import {
  BooleanValue,
  DateValue,
  EmailValue,
  FloatValue,
  HTMLValue,
  MarkdownValue,
  PathValue,
  PhoneValue,
  StringValue,
} from "../../src";
import {
  TestCoordinatesValue,
  TestUUIDValue,
} from "../support/fixtures";

describe("Value object validation", () => {
  it("rejects path traversal, invalid dates, unanchored phones, and accepts modern email addresses", () => {
    class UploadPath extends PathValue {
      readonly attributeName = "uploadPath";
    }
    expect(new UploadPath("/var/uploads/report.pdf", ["/var/uploads"]).isValid).toBe(true);
    expect(new UploadPath("/var/uploads/../../etc/passwd", ["/var/uploads"]).isValid).toBe(false);
    expect(new UploadPath("/var/uploads-other/file.txt", ["/var/uploads"]).isValid).toBe(false);
    expect(new UploadPath("/var/uploads/file\0.txt", ["/var/uploads"]).isValid).toBe(false);

    class CreatedDate extends DateValue {
      readonly attributeName = "createdAt";
    }
    expect(CreatedDate.fromPrimitives("not-a-valid-date").isValid).toBe(false);
    expect(CreatedDate.fromPrimitives("2026-10-28T00:00:00.000Z").isValid).toBe(true);

    class ContactPhone extends PhoneValue {
      readonly attributeName = "phone";
    }
    expect(new ContactPhone("+12345678901").isValid).toBe(true);
    expect(new ContactPhone("call me at +12345678901").isValid).toBe(false);

    class UserEmail extends EmailValue {
      readonly attributeName = "email";
    }
    expect(new UserEmail("dev+alerts@company.engineering").isValid).toBe(true);
  });

  it("accepts UUIDv7 case-insensitively and validates String, Coordinates, and Boolean values", () => {
    const uuidV7Lower = TestUUIDValue.fromPrimitives("018f3b24-a450-7b2c-9d1e-34567890abcd");
    const uuidV7Upper = TestUUIDValue.fromPrimitives("018F3B24-A450-7B2C-9D1E-34567890ABCD");
    expect(uuidV7Lower.isValid).toBe(true);
    expect(uuidV7Lower.equals(uuidV7Upper)).toBe(true);

    class EmptyOnlyString extends StringValue {
      readonly attributeName = "empty";
    }
    expect(new EmptyOnlyString("", 0, 0).isValid).toBe(true);
    expect(new EmptyOnlyString("a", 0, 0).isValid).toBe(false);

    expect(TestCoordinatesValue.fromPrimitives({ latitude: Number.NaN, longitude: 0 }).isValid).toBe(false);

    class FlagBoolean extends BooleanValue {
      readonly attributeName = "flag";
    }
    expect(new FlagBoolean(true).isValid).toBe(true);
    expect(new FlagBoolean("true" as unknown as boolean).isValid).toBe(false);
  });

  it("rejects Infinity in FloatValue and rounds IEEE-754 values correctly", () => {
    class PriceFloat extends FloatValue {
      readonly attributeName = "price";
    }
    expect(new PriceFloat(Number.POSITIVE_INFINITY).isValid).toBe(false);
    expect(new PriceFloat(Number.NEGATIVE_INFINITY).isValid).toBe(false);
    const roundedPrice = new PriceFloat(1.005, 2);
    expect(roundedPrice.value).toBe(1.01);
    expect(roundedPrice.toString()).toBe("1.01");
    expect(roundedPrice.toJSON()).toBe(1.01);
  });

  it("normalizes Float, HTML, and Markdown values through fromPrimitives", () => {
    class PriceFloat extends FloatValue {
      readonly attributeName = "price";
    }
    class SnippetHTML extends HTMLValue {
      readonly attributeName = "snippet";
    }
    class ReadmeMarkdown extends MarkdownValue {
      readonly attributeName = "readme";
    }

    const price = PriceFloat.fromPrimitives(19.995, 2);
    expect(price.toPrimitives()).toBe(20);
    expect(price.isValid).toBe(true);

    const html = SnippetHTML.fromPrimitives("<p>Hello</p>");
    expect(html.toPrimitives()).toBe("<p>Hello</p>");
    expect(html.isValid).toBe(true);

    const md = ReadmeMarkdown.fromPrimitives("# Title");
    expect(md.toPrimitives()).toBe("# Title");
    expect(md.isValid).toBe(true);
  });
});
