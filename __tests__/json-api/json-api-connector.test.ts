import { JSONAPIConnector } from "../../src/json-api";
import { Criteria } from "../../src/criteria";
import type { HTTPProvider } from "../../src/http";

describe("JSONAPIConnector", () => {
  const base = new URL("https://api.example.com/users");
  let http: jest.Mocked<HTTPProvider>;
  let connector: JSONAPIConnector;

  beforeEach(() => {
    http = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };
    connector = new JSONAPIConnector(http);
  });

  it("calls findOne with correct URL and criteria", async () => {
    const criteria = new Criteria().where("status", "EQUAL", "active");
    const include = ["roles"];

    await connector.findOne(base, criteria, include);

    expect(http.get).toHaveBeenCalledWith(expect.any(URL));

    const calledUrl = http.get.mock.calls[0][0];
    
    expect(calledUrl.searchParams.get("filter[status]")).toBe("active");
    expect(calledUrl.href).toContain("include=roles");
  });

  it("calls findMany with sorting and pagination", async () => {
    const criteria = new Criteria()
      .orderBy("createdAt", "DESC")
      .limitResults(10)
      .offsetResults(20);

    await connector.findMany(base, criteria);

    const calledUrl = http.get.mock.calls[0][0];

    expect(calledUrl.href).toContain("sort=-createdAt");
    expect(calledUrl.searchParams.get("page[limit]")).toBe("10");
    expect(calledUrl.searchParams.get("page[offset]")).toBe("20");
  });

  it("calls create with correct payload", async () => {
    const payload = {
      type: "users",
      attributes: { name: "Jorge", email: "jorge@example.com" },
    };

    await connector.create(base, payload);

    expect(http.post).toHaveBeenCalledWith(base, { data: payload });
  });

  it("calls update with correct payload", async () => {
    const payload = {
      id: "123",
      type: "users",
      attributes: { name: "Jorge Updated" },
    };

    await connector.update(base, payload);

    expect(http.patch).toHaveBeenCalledWith(base, { data: payload });
  });

  it("calls delete with correct URL", async () => {
    await connector.delete(base);

    expect(http.delete).toHaveBeenCalledWith(base);
  });
});
