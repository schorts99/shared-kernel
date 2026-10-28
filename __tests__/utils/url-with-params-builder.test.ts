import {
  URLWithParamsBuilder,
} from "../../src";

describe("URLWithParamsBuilder", () => {
  it("builds a new URL with array and removed params without mutating the original", () => {
    const originalUrl = new URL("https://api.example.com/items?tag=legacy&keep=1");
    const builtUrl = new URLWithParamsBuilder(originalUrl)
      .with({ tag: ["alpha", "beta"], keep: undefined, page: 2 })
      .build();

    expect(originalUrl.toString()).toBe("https://api.example.com/items?tag=legacy&keep=1");
    expect(builtUrl.searchParams.getAll("tag")).toEqual(["alpha", "beta"]);
    expect(builtUrl.searchParams.get("keep")).toBeNull();
    expect(builtUrl.searchParams.get("page")).toBe("2");
  });
});
