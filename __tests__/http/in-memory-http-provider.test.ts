import {
  InMemoryHTTPProvider,
} from "../../src";

describe("InMemoryHTTPProvider", () => {
  it("routes requests and records them", async () => {
    const memHttp = new InMemoryHTTPProvider({ baseUrl: "https://api.example.com" });
    memHttp.on("GET", "/orders", req => ({
      items: ["o-1"],
      filter: req.url.searchParams.getAll("status"),
    }));

    const ordersRes = await memHttp.get<{ items: string[]; filter: string[] }>("/orders", {
      query: { status: ["open", "pending"] },
    });
    expect(ordersRes).toEqual({ items: ["o-1"], filter: ["open", "pending"] });
    expect(memHttp.getRequests()).toHaveLength(1);
    expect(memHttp.getRequests()[0]?.url.href).toBe(
      "https://api.example.com/orders?status=open&status=pending",
    );

    await expect(memHttp.get("/missing")).rejects.toThrow("HTTP Error 404");
  });
});
