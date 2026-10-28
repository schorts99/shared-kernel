import {
  InMemoryFileProvider,
} from "../../src";

describe("InMemoryFileProvider", () => {
  it("uploads, resolves URLs, and deletes files", async () => {
    const fileProvider = new InMemoryFileProvider({ baseUrl: "https://cdn.example.com" });
    const uploadedKey = await fileProvider.upload(
      Buffer.from("file-contents"),
      "/invoices/2026/",
      "inv-001.txt",
      { contentType: "text/plain" },
    );
    expect(uploadedKey).toBe("invoices/2026/inv-001.txt");
    expect(await fileProvider.exists("invoices/2026", "inv-001.txt")).toBe(true);
    expect((await fileProvider.get("invoices/2026/inv-001.txt")).toString("utf8")).toBe(
      "file-contents",
    );
    expect(await fileProvider.list("invoices/")).toEqual(["invoices/2026/inv-001.txt"]);
    expect(fileProvider.getPublicURL("invoices/2026", "inv-001.txt")).toBe(
      "https://cdn.example.com/invoices/2026/inv-001.txt",
    );
    await fileProvider.delete("invoices/2026", "inv-001.txt");
    expect(await fileProvider.exists("invoices/2026", "inv-001.txt")).toBe(false);
  });
});
