import {
  RemoteFileToBase64,
} from "../../src";

describe("RemoteFileToBase64", () => {
  it("converts Blobs in Node.js without FileReader", async () => {
    const converter = new RemoteFileToBase64({
      get: async () => new Blob(["hello world"], { type: "text/plain" }) as any,
      post: async () => undefined as any,
      put: async () => undefined as any,
      patch: async () => undefined as any,
      delete: async () => undefined as any,
    });

    const converted = await converter.convert(new URL("https://cdn.example.com/hello.txt"), {
      cache: true,
      expectedMimeTypes: ["text/*"],
    });
    expect(converted.mimeType).toBe("text/plain");
    expect(converted.base64).toBe(
      `data:text/plain;base64,${Buffer.from("hello world").toString("base64")}`,
    );
    expect(converted.cached).toBe(false);

    const cachedConverted = await converter.convert(new URL("https://cdn.example.com/hello.txt"), {
      cache: true,
    });
    expect(cachedConverted.cached).toBe(true);
  });

  it("normalizes MIME params, aborts on timeout, and isolates cached results", async () => {
    let getSignalAborted = false;
    const converter = new RemoteFileToBase64({
      get: async (url, options) => {
        if (url.toString().includes("slow")) {
          return await new Promise<any>((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => {
                getSignalAborted = true;
                reject(options.signal?.reason);
              },
              { once: true },
            );
          });
        }
        return new Blob(["charset test"], { type: "TEXT/PLAIN; charset=utf-8" }) as any;
      },
      post: async () => undefined as any,
      put: async () => undefined as any,
      patch: async () => undefined as any,
      delete: async () => undefined as any,
    });

    const res = await converter.convert(new URL("https://cdn.example.com/file.txt"), {
      cache: true,
      expectedMimeTypes: ["text/plain"],
    });
    expect(res.mimeType).toBe("text/plain");
    res.base64 = "mutated";

    const cachedRes = await converter.convert(new URL("https://cdn.example.com/file.txt"), {
      cache: true,
    });
    expect(cachedRes.base64).not.toBe("mutated");

    await expect(
      converter.convert(new URL("https://cdn.example.com/slow.txt"), { timeout: 15 }),
    ).rejects.toThrow("Conversion timeout after 15ms");
    expect(getSignalAborted).toBe(true);
  });
});
