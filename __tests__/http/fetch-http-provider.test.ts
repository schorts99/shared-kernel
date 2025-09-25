import { FetchHTTPProvider, HTTPException } from "../../src/http";

const url = new URL("https://api.example.com/resource");

function createMockResponse({
  ok = true,
  status = 200,
  contentType = "application/json",
  body = {},
}: {
  ok?: boolean;
  status?: number;
  contentType?: string;
  body?: any;
}): Promise<Response> {
  return Promise.resolve({
    ok,
    status,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "content-type" ? contentType : null,
    },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    blob: async () =>
      new Blob([typeof body === "string" ? body : JSON.stringify(body)], {
        type: contentType,
      }),
  } as unknown as Response);
}

describe("FetchHTTPProvider", () => {
  let provider: FetchHTTPProvider;

  beforeEach(() => {
    provider = new FetchHTTPProvider();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("parses JSON response", async () => {
    const mockJson = { message: "success" };

    (global.fetch as jest.Mock).mockImplementation(() =>
      createMockResponse({ body: mockJson })
    );

    const result = await provider.get<typeof mockJson>(url);

    expect(result).toEqual(mockJson);
  });

  it("parses text response", async () => {
    const mockText = "plain text";

    (global.fetch as jest.Mock).mockImplementation(() =>
      createMockResponse({ contentType: "text/plain", body: mockText })
    );

    const result = await provider.get<string>(url);

    expect(result).toEqual(mockText);
  });

  it("parses blob response", async () => {
    const mockBinary = "image data";

    (global.fetch as jest.Mock).mockImplementation(() =>
      createMockResponse({ contentType: "image/png", body: mockBinary })
    );

    const result = await provider.get<Blob>(url);

    expect(result).toBeInstanceOf(Blob);
  });

  it("returns undefined for 204 No Content", async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      createMockResponse({ status: 204, body: undefined })
    );

    const result = await provider.get<undefined>(url);

    expect(result).toBeUndefined();
  });

  it("throws HTTPException on failed JSON response", async () => {
    const errorJson = { title: "Unauthorized", code: 401 };

    (global.fetch as jest.Mock).mockImplementation(() =>
      createMockResponse({ ok: false, status: 401, body: errorJson })
    );

    await expect(provider.get(url)).rejects.toThrow(HTTPException);
  });

  it("throws HTTPException on failed text response", async () => {
    const errorText = "Forbidden";

    (global.fetch as jest.Mock).mockImplementation(() =>
      createMockResponse({
        ok: false,
        status: 403,
        contentType: "text/plain",
        body: errorText,
      })
    );

    await expect(provider.get(url)).rejects.toThrow(HTTPException);
  });

  it("deduplicates ongoing requests", async () => {
    const mockJson = { message: "deduplicated" };
    
    (global.fetch as jest.Mock).mockImplementation(() =>
      createMockResponse({ body: mockJson })
    );

    const promise1 = provider.get<typeof mockJson>(url);
    const promise2 = provider.get<typeof mockJson>(url);

    expect(promise1).toStrictEqual(promise2);

    const result = await promise1;

    expect(result).toEqual(mockJson);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("cleans up ongoingRequests after completion", async () => {
    const mockJson = { message: "done" };

    (global.fetch as jest.Mock).mockImplementation(() =>
      createMockResponse({ body: mockJson })
    );

    await provider.get<typeof mockJson>(url);

    const key = `GET:${url.href}:`;
    const internalMap = (provider as any).ongoingRequests as Map<string, Promise<any>>;

    expect(internalMap.has(key)).toBe(false);
  });

  it("throws if fetch returns undefined", async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve(undefined as any)
    );    

    await expect(provider.get(url)).rejects.toThrow(HTTPException);
  });
});
