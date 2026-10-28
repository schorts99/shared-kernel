import { expectTypeOf } from "expect-type";
import {
  Criteria,
  readBetweenBounds,
  readGeoPoint,
  readGeoRadius,
  URLCriteriaBuilder,
  URLCriteriaParser,
} from "../../src";
import type { Filter, FilterValue } from "../../src";

describe("readGeoPoint", () => {
  it("reads tuples and lat/lng, lat/lon, and latitude/longitude objects", () => {
    expect(readGeoPoint([40.7, -74])).toEqual({ lat: 40.7, lng: -74 });
    expect(readGeoPoint({ lat: 40.7, lng: -74 })).toEqual({ lat: 40.7, lng: -74 });
    expect(readGeoPoint({ lat: 40.7, lon: -74 })).toEqual({ lat: 40.7, lng: -74 });
    expect(readGeoPoint({ latitude: 40.7, longitude: -74 })).toEqual({ lat: 40.7, lng: -74 });
  });

  it("returns null for missing, short, non-numeric, or non-object input", () => {
    expect(readGeoPoint(null)).toBeNull();
    expect(readGeoPoint([40.7])).toBeNull();
    expect(readGeoPoint({ lat: "north", lng: 0 })).toBeNull();
    expect(readGeoPoint({ lat: 1 })).toBeNull();
    expect(readGeoPoint("40.7,-74")).toBeNull();
  });
});

describe("readGeoRadius", () => {
  it("reads a center or inline point with a radius in meters or kilometers", () => {
    expect(readGeoRadius({ center: [1, 2], radiusInM: 500 })).toEqual({ lat: 1, lng: 2, radiusInM: 500 });
    expect(readGeoRadius({ lat: 1, lng: 2, radius: 500 })).toEqual({ lat: 1, lng: 2, radiusInM: 500 });
    expect(readGeoRadius({ latitude: 1, longitude: 2, radiusMeters: 500 })).toEqual({ lat: 1, lng: 2, radiusInM: 500 });
    expect(readGeoRadius({ center: { lat: 1, lon: 2 }, radiusInKm: 2.5 })).toEqual({ lat: 1, lng: 2, radiusInM: 2500 });
  });

  it("prefers radiusInM over the other radius fields", () => {
    expect(readGeoRadius({ center: [1, 2], radiusInM: 10, radius: 20, radiusInKm: 30 })?.radiusInM).toBe(10);
  });

  it("returns null without a usable center or a finite, non-negative radius", () => {
    expect(readGeoRadius([1, 2])).toBeNull();
    expect(readGeoRadius({ radiusInM: 10 })).toBeNull();
    expect(readGeoRadius({ center: [1, 2] })).toBeNull();
    expect(readGeoRadius({ center: [1, 2], radiusInM: -1 })).toBeNull();
    expect(readGeoRadius({ center: [1, 2], radiusInM: Number.POSITIVE_INFINITY })).toBeNull();
    expect(readGeoRadius(undefined)).toBeNull();
  });
});

describe("readBetweenBounds", () => {
  it("reads [min, max], { min, max }, and { from, to }", () => {
    expect(readBetweenBounds([1, 5])).toEqual([1, 5]);
    expect(readBetweenBounds({ min: 1, max: 5 })).toEqual([1, 5]);
    expect(readBetweenBounds({ from: "a", to: "m" })).toEqual(["a", "m"]);
  });

  it("returns null for incomplete bounds", () => {
    expect(readBetweenBounds([1])).toBeNull();
    expect(readBetweenBounds([1, 2, 3])).toBeNull();
    expect(readBetweenBounds({ min: 1 })).toBeNull();
    expect(readBetweenBounds("1,5")).toBeNull();
  });
});

describe("URLCriteriaBuilder with flexible filter values", () => {
  const build = (criteria: Criteria) =>
    new URLCriteriaBuilder(new URL("https://api.example.com/stores"), criteria).build();

  it("serializes every GEO_RADIUS shape the in-memory DAO accepts", () => {
    const fromKm = build(Criteria.none().where("location", "GEO_RADIUS", { center: { lat: 1, lon: 2 }, radiusInKm: 3 }));
    expect(fromKm.searchParams.get("filter[location][geo_radius]")).toBe("1,2,3000");

    const inline = build(Criteria.none().where("location", "GEO_RADIUS", { latitude: 1, longitude: 2, radiusInM: 50 }));
    expect(inline.searchParams.get("filter[location][geo_radius]")).toBe("1,2,50");
  });

  it("serializes BETWEEN given as { min, max } or { from, to }", () => {
    expect(build(Criteria.none().where("score", "BETWEEN", { min: 10, max: 20 })).searchParams.get("filter[score][between]")).toBe("10,20");
    expect(build(Criteria.none().where("score", "BETWEEN", { from: 1, to: 2 })).searchParams.get("filter[score][between]")).toBe("1,2");
  });

  it("round-trips a kilometer radius through the parser", () => {
    const url = build(Criteria.none().where("location", "GEO_RADIUS", { center: [1, 2], radiusInKm: 1 }));
    const [filter] = new URLCriteriaParser(url).parse().filters;

    expect(filter?.operator).toBe("GEO_RADIUS");
    expect(readGeoRadius(filter?.value)).toEqual({ lat: 1, lng: 2, radiusInM: 1000 });
  });
});

describe("Criteria.where value typing", () => {
  it("requires the value shape each operator expects", () => {
    const criteria = Criteria.none();

    criteria.where("status", "EQUAL", { nested: true });
    criteria.where("total", "GREATER_THAN", 10);
    criteria.where("createdAt", "LESS_THAN", new Date());
    criteria.where("status", "IN", ["open", "closed"]);
    criteria.where("name", "LIKE", "alpha%");
    criteria.where("score", "BETWEEN", [1, 5]);
    criteria.where("location", "GEO_RADIUS", { center: [1, 2], radiusInM: 10 });

    // @ts-expect-error IN needs an array
    criteria.where("status", "IN", "open");
    // @ts-expect-error LIKE needs a string pattern
    criteria.where("name", "LIKE", 5);
    // @ts-expect-error range operators need a comparable value
    criteria.where("total", "GREATER_THAN", { amount: 10 });
    // @ts-expect-error BETWEEN needs two bounds
    criteria.where("score", "BETWEEN", [1]);
    // @ts-expect-error GEO_RADIUS needs a radius
    criteria.where("location", "GEO_RADIUS", { center: [1, 2] });

    expect(criteria.filters).toHaveLength(0);
  });

  it("narrows Filter values by operator", () => {
    const describeFilter = (filter: Filter): string => {
      switch (filter.operator) {
        case "IN":
          expectTypeOf(filter.value).toEqualTypeOf<ReadonlyArray<unknown>>();
          return `${filter.field} in ${filter.value.length} values`;
        case "LIKE":
          expectTypeOf(filter.value).toEqualTypeOf<string>();
          return `${filter.field} like ${filter.value.toUpperCase()}`;
        default:
          return filter.field;
      }
    };

    const criteria = Criteria.none().where("status", "IN", ["a", "b"]).where("name", "LIKE", "x%");
    expect(criteria.filters.map(describeFilter)).toEqual(["status in 2 values", "name like X%"]);
    expectTypeOf<FilterValue<"BETWEEN">>().toMatchTypeOf<unknown>();
  });
});
