import {
  Criteria,
  URLCriteriaBuilder,
  URLCriteriaParser,
} from "../../src";

describe("URLCriteriaBuilder and URLCriteriaParser", () => {
  it("parse numbers, booleans, dates, and array_contains_any, and keep offset 0", () => {
    const baseUrl = new URL("https://api.example.com/orders?filter[tenant]=acme");
    const built = new URLCriteriaBuilder(
      baseUrl,
      Criteria.none()
        .where("amount", "GREATER_THAN", 42)
        .where("active", "EQUAL", true)
        .where("createdAt", "GREATER_THAN_OR_EQUAL", "2026-01-15T00:00:00.000Z")
        .where("tags", "ARRAY_CONTAINS_ANY", ["urgent", "vip"])
        .limitResults(10)
        .offsetResults(0),
    ).build();

    const parsed = new URLCriteriaParser(built).parse();
    expect(parsed.limit).toBe(10);
    expect(parsed.offset).toBe(0);

    const amountFilter = parsed.filters.find(f => f.field === "amount");
    expect(amountFilter?.value).toBe(42);
    expect(typeof amountFilter?.value).toBe("number");

    const activeFilter = parsed.filters.find(f => f.field === "active");
    expect(activeFilter?.value).toBe(true);

    const dateFilter = parsed.filters.find(f => f.field === "createdAt");
    expect(dateFilter?.value).toBeInstanceOf(Date);

    const tagsFilter = parsed.filters.find(f => f.field === "tags");
    expect(tagsFilter?.operator).toBe("ARRAY_CONTAINS_ANY");
    expect(tagsFilter?.value).toEqual(["urgent", "vip"]);
  });

  it("round-trip GEO_RADIUS and Date filters", () => {
    const startDate = new Date("2026-01-15T10:30:00.000Z");
    const initialCriteria = Criteria.none()
      .where("createdAt", "GREATER_THAN_OR_EQUAL", startDate)
      .where("location", "GEO_RADIUS", { center: [40.7128, -74.006], radiusInM: 2500 });

    const builtUrl = new URLCriteriaBuilder(
      new URL("https://api.example.com/events"),
      initialCriteria,
    ).build();

    expect(builtUrl.searchParams.get("filter[createdAt][gte]")).toBe("2026-01-15T10:30:00.000Z");
    expect(builtUrl.searchParams.get("filter[location][geo_radius]")).toBe(
      "40.7128,-74.006,2500",
    );

    const parsedCriteria = new URLCriteriaParser(builtUrl, ["createdAt", "location"]).parse();
    expect(parsedCriteria.filters[0]?.value).toEqual(startDate);
    expect(parsedCriteria.filters[1]?.value).toEqual({
      center: [40.7128, -74.006],
      radiusInM: 2500,
      lat: 40.7128,
      lng: -74.006,
      radius: 2500,
    });

    const rebuiltUrl = new URLCriteriaBuilder(
      new URL("https://api.example.com/events"),
      parsedCriteria,
    ).build();
    expect(rebuiltUrl.toString()).toBe(builtUrl.toString());
  });
});
