import {
  FetchHTTPProvider,
  HTTPException,
} from "../../src";

describe("FetchHTTPProvider", () => {
  it("supports array and replacement query params, async authorization, empty JSON bodies, and HTTPException messages", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedAuth: string | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedAuth = new Headers(init?.headers).get("Authorization");
      return new Response("", {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const http = new FetchHTTPProvider({
        baseUrl: "https://api.example.com",
        getAuthorization: async () => "Bearer async-token-123",
      });

      const res = await http.post("/items?page=1", {
        query: { page: 2, tag: ["x", "y"] },
        body: { name: "Item" },
      });

      expect(res).toBeUndefined();
      expect(capturedUrl).toBe("https://api.example.com/items?page=2&tag=x&tag=y");
      expect(capturedAuth).toBe("Bearer async-token-123");
    } finally {
      globalThis.fetch = originalFetch;
    }

    const httpErr = new HTTPException(422, { error: "Unprocessable" });
    expect(httpErr.name).toBe("HTTPException");
    expect(httpErr.message).toBe("HTTP Error 422");
  });
});
