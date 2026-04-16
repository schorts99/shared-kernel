import { Criteria } from "../../src/criteria/criteria";
import { LimitNotValid, OffsetNotValid } from "../../src/criteria/exceptions";

describe("Criteria", () => {
  it("should create an empty criteria", () => {
    const criteria = Criteria.none();

    expect(criteria.filters).toEqual([]);
    expect(criteria.orders).toEqual([]);
    expect(criteria.limit).toBeUndefined();
    expect(criteria.offset).toBeUndefined();
    expect(criteria.hasFilters()).toBe(false);
    expect(criteria.hasOrders()).toBe(false);
  });

  it("should create a new instance when adding a filter", () => {
    const criteria = Criteria.none();
    const newCriteria = criteria.where("field", "EQUAL", "value");

    expect(newCriteria).not.toBe(criteria);
    expect(newCriteria.filters).toEqual([{ field: "field", operator: "EQUAL", value: "value" }]);
    expect(criteria.filters).toEqual([]);
    expect(newCriteria.hasFilters()).toBe(true);
  });

  it("should create a new instance when adding an order", () => {
    const criteria = Criteria.none();
    const newCriteria = criteria.orderBy("field", "DESC");

    expect(newCriteria).not.toBe(criteria);
    expect(newCriteria.orders).toEqual([{ field: "field", direction: "DESC" }]);
    expect(criteria.orders).toEqual([]);
    expect(newCriteria.hasOrders()).toBe(true);
  });

  it("should default to ASC when adding an order without direction", () => {
    const criteria = Criteria.none();
    const newCriteria = criteria.orderBy("field");

    expect(newCriteria.orders).toEqual([{ field: "field", direction: "ASC" }]);
  });

  it("should create a new instance when setting a limit", () => {
    const criteria = Criteria.none();
    const newCriteria = criteria.limitResults(10);

    expect(newCriteria).not.toBe(criteria);
    expect(newCriteria.limit).toBe(10);
    expect(criteria.limit).toBeUndefined();
  });

  it("should throw an error when setting a limit less than 1", () => {
    const criteria = Criteria.none();

    expect(() => criteria.limitResults(0)).toThrow(LimitNotValid);
    expect(() => criteria.limitResults(-1)).toThrow(LimitNotValid);
  });

  it("should create a new instance when setting an offset", () => {
    const criteria = Criteria.none();
    const newCriteria = criteria.offsetResults(5);

    expect(newCriteria).not.toBe(criteria);
    expect(newCriteria.offset).toBe(5);
    expect(criteria.offset).toBeUndefined();
  });

  it("should throw an error when setting an offset less than 1", () => {
    const criteria = Criteria.none();

    expect(() => criteria.offsetResults(0)).toThrow(OffsetNotValid);
    expect(() => criteria.offsetResults(-1)).toThrow(OffsetNotValid);
  });

  it("should allow chaining multiple methods independently", () => {
    const base = Criteria.none().where("name", "EQUAL", "John");
    const withLimit = base.limitResults(10);
    const withOrder = base.orderBy("age", "ASC");

    expect(withLimit.filters).toEqual(base.filters);
    expect(withLimit.limit).toBe(10);
    expect(withLimit.orders).toEqual([]);
    expect(withOrder.filters).toEqual(base.filters);
    expect(withOrder.orders).toEqual([{ field: "age", direction: "ASC" }]);
    expect(withOrder.limit).toBeUndefined();
  });
});
