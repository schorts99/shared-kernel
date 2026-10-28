import {
  Criteria,
  HTTPException,
  JSONAPIConnector,
  JSONAPIErrors,
} from "../../src";
import type { HTTPProvider, HTTPRequestOptions } from "../../src";

type Call = { method: string; url: string; options: HTTPRequestOptions | undefined };

function createHTTP(respond: (call: Call) => unknown = () => ({ data: null })) {
  const calls: Call[] = [];
  const handle = (method: string) => async (url: string | URL, options?: HTTPRequestOptions) => {
    const call = { method, url: url.toString(), options };
    calls.push(call);
    return respond(call) as any;
  };
  const http: HTTPProvider = {
    get: handle("GET"),
    post: handle("POST"),
    put: handle("PUT"),
    patch: handle("PATCH"),
    delete: handle("DELETE"),
  };

  return { http, calls };
}

describe("JSONAPIConnector", () => {
  it("adds criteria and include params to absolute string and URL targets", async () => {
    const { http, calls } = createHTTP();
    const connector = new JSONAPIConnector(http);
    const criteria = Criteria.none().where("status", "EQUAL", "active");

    await connector.findMany("https://api.example.com/orders", { criteria, include: ["customer", "items"] });
    await connector.findOne(new URL("https://api.example.com/orders/1"), { include: ["customer"] });

    const many = new URL(calls[0]!.url);
    expect(many.origin + many.pathname).toBe("https://api.example.com/orders");
    expect(many.searchParams.get("include")).toBe("customer,items");
    expect([...many.searchParams.keys()].some(key => key.startsWith("filter"))).toBe(true);
    expect(new URL(calls[1]!.url).searchParams.get("include")).toBe("customer");
  });

  it("keeps relative targets relative", async () => {
    const { http, calls } = createHTTP();
    const connector = new JSONAPIConnector(http);

    await connector.findMany("/orders", { include: ["customer"] });
    await connector.findMany("orders?page[size]=5");
    await connector.findOne("orders/1");

    expect(calls[0]!.url).toBe("/orders?include=customer");
    expect(calls[1]!.url.startsWith("orders?")).toBe(true);
    expect(calls[1]!.url).toContain("page");
    expect(calls[2]!.url).toBe("orders/1");
  });

  it("wraps create and update payloads in a data envelope", async () => {
    const { http, calls } = createHTTP(call => ({ data: { id: "1", type: "orders", echo: call.method } }));
    const connector = new JSONAPIConnector(http);

    const created = await connector.create<{ total: number }>(
      "/orders",
      { type: "orders", attributes: { total: 10 } },
      { headers: { "X-Trace": "t-1" } },
    );
    await connector.update<{ total: number }>("/orders/1", { id: "1", type: "orders", attributes: { total: 20 } });
    await connector.delete("/orders/1");

    expect(created.data).toMatchObject({ id: "1", echo: "POST" });
    expect(calls.map(c => c.method)).toEqual(["POST", "PATCH", "DELETE"]);
    expect(calls[0]!.options).toMatchObject({
      headers: { "X-Trace": "t-1" },
      body: { data: { type: "orders", attributes: { total: 10 } } },
    });
    expect(calls[1]!.options?.body).toEqual({ data: { id: "1", type: "orders", attributes: { total: 20 } } });
  });

  it("converts JSON:API error bodies into JSONAPIErrors and rethrows anything else", async () => {
    const errors = [{ status: "422", code: "invalid", title: "Invalid", detail: "total must be positive" }];
    const failing = createHTTP(call => {
      throw call.method === "POST"
        ? new HTTPException(422, { errors })
        : call.method === "PATCH"
          ? new HTTPException(500, { message: "oops" })
          : new TypeError("network down");
    });
    const connector = new JSONAPIConnector(failing.http);

    const createError = await connector
      .create("/orders", { type: "orders", attributes: {} })
      .catch((error: unknown) => error);
    expect(createError).toBeInstanceOf(JSONAPIErrors);
    expect((createError as JSONAPIErrors).errors).toEqual(errors);
    expect((createError as JSONAPIErrors).message).toBe("Invalid: total must be positive");

    await expect(connector.update("/orders/1", { id: "1", type: "orders", attributes: {} })).rejects.toBeInstanceOf(HTTPException);
    await expect(connector.delete("/orders/1")).rejects.toThrow("network down");
    await expect(connector.findMany("/orders")).rejects.toThrow("network down");
    await expect(connector.findOne("/orders/1")).rejects.toThrow("network down");
  });
});
