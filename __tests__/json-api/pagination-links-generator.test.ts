import {
  OffsetNotValid,
  PaginationLinksGenerator,
} from "../../src";

describe("PaginationLinksGenerator", () => {
  it("preserves existing query params without a duplicate '?'", () => {
    const links = new PaginationLinksGenerator(
      new URL("https://api.example.com/orders?filter[status]=open"),
    ).generate(0, 10, 25);

    expect(links.self).toBe("https://api.example.com/orders?filter[status]=open&page[offset]=0&page[limit]=10");
    expect(links.next).toBe("https://api.example.com/orders?filter[status]=open&page[offset]=10&page[limit]=10");
    expect(links.prev).toBeNull();
  });

  it("preserves hash fragments and validates safe integers", () => {
    const linksGen = new PaginationLinksGenerator(
      new URL("https://api.example.com/orders#results"),
    );
    const links = linksGen.generate(0, 10, 25);
    expect(links.self).toBe("https://api.example.com/orders?page[offset]=0&page[limit]=10#results");
    expect(links.next).toBe("https://api.example.com/orders?page[offset]=10&page[limit]=10#results");
    expect(() => linksGen.generate(1.5, 10, 25)).toThrow(OffsetNotValid);
  });
});
