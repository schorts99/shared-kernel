import {
  Criteria,
  JSONAPIConnector,
} from "../../src";

describe("JSONAPIConnector URLs", () => {
  it("handles relative URLs", async () => {
    const requestedUrls: Array<string | URL> = [];
    const connector = new JSONAPIConnector({
      get: async url => {
        requestedUrls.push(url);
        return { data: [] } as any;
      },
      post: async () => ({ data: {} }) as any,
      put: async () => ({ data: {} }) as any,
      patch: async () => ({ data: {} }) as any,
      delete: async () => undefined as any,
    });

    await connector.findMany("/orders", {
      criteria: Criteria.none().where("page", "EQUAL", 1).limitResults(5).offsetResults(0),
      include: ["customer"],
    });
    expect(requestedUrls[0]).toBe("/orders?include=customer&filter%5Bpage%5D=1&page%5Blimit%5D=5&page%5Boffset%5D=0");
  });
});
