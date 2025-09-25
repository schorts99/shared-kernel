import { URLCriteriaBuilder } from "../../src/json-api";
import { Criteria } from "../../src/criteria";

const base = new URL("https://api.example.com/resources");

describe("URLCriteriaBuilder", () => {
  it("encodes EQUAL filters as filter[field]=value", () => {
    const criteria = new Criteria().where("status", "EQUAL", "active");
    const url = new URLCriteriaBuilder(base, criteria).build();

    expect(url.searchParams.get("filter[status]")).toBe("active");
  });

  it("encodes IN filters as comma-separated values", () => {
    const criteria = new Criteria().where("role", "IN", ["admin", "editor"]);
    const url = new URLCriteriaBuilder(base, criteria).build();

    expect(url.searchParams.get("filter[role]")).toBe("admin,editor");
  });

  it("encodes other operators as filter[field][operator]=value", () => {
    const criteria = new Criteria().where("createdAt", "GREATER_THAN", "2023-01-01");
    const url = new URLCriteriaBuilder(base, criteria).build();

    expect(url.searchParams.get("filter[createdAt][GREATER_THAN]")).toBe("2023-01-01");
  });

  it("supports nested filters using dot notation", () => {
    const criteria = new Criteria().where("roles.name", "EQUAL", "admin");
    const url = new URLCriteriaBuilder(base, criteria).build();

    expect(url.searchParams.get("filter[roles.name]")).toBe("admin");
  });

  it("encodes sorting correctly", () => {
    const criteria = new Criteria()
      .orderBy("createdAt", "DESC")
      .orderBy("name", "ASC");
    const url = new URLCriteriaBuilder(base, criteria).build();

    expect(url.searchParams.get("sort")).toBe("-createdAt,name");
  });

  it("encodes pagination correctly", () => {
    const criteria = new Criteria().limitResults(20).offsetResults(40);
    const url = new URLCriteriaBuilder(base, criteria).build();

    expect(url.searchParams.get("page[limit]")).toBe("20");
    expect(url.searchParams.get("page[offset]")).toBe("40");
  });

  it("adds include parameters", () => {
    const url = new URLCriteriaBuilder(base, undefined, ["roles", "permissions"]).build();

    expect(url.searchParams.getAll("include")).toEqual(["roles", "permissions"]);
  });

  it("builds full query with filters, sort, pagination, and includes", () => {
    const criteria = new Criteria()
      .where("status", "EQUAL", "active")
      .where("roles.name", "EQUAL", "admin")
      .orderBy("createdAt", "DESC")
      .limitResults(10)
      .offsetResults(30);
    const url = new URLCriteriaBuilder(base, criteria, ["roles"]).build();

    expect(url.searchParams.get("filter[status]")).toBe("active");
    expect(url.searchParams.get("filter[roles.name]")).toBe("admin");
    expect(url.searchParams.get("sort")).toBe("-createdAt");
    expect(url.searchParams.get("page[limit]")).toBe("10");
    expect(url.searchParams.get("page[offset]")).toBe("30");
    expect(url.searchParams.getAll("include")).toEqual(["roles"]);
  });
});
