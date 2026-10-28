import {
  CommitOutcomeUnknownError,
  InMemoryIdempotencyStore,
} from "../../src";

describe("InMemoryIdempotencyStore", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects an invalid maxEntries", () => {
    expect(() => new InMemoryIdempotencyStore({ maxEntries: 0 })).toThrow(RangeError);
    expect(() => new InMemoryIdempotencyStore({ maxEntries: 2.5 })).toThrow(RangeError);
  });

  it("runs concurrent calls for the same key once and gives each caller its own copy", async () => {
    const store = new InMemoryIdempotencyStore();
    const operation = jest.fn(async () => ({ items: ["a"] }));

    const [first, second] = await Promise.all([store.execute("k", operation), store.execute("k", operation)]);
    first.items.push("mutated");

    expect(operation).toHaveBeenCalledTimes(1);
    expect(second.items).toEqual(["a"]);
    expect(await store.execute("k", operation)).toEqual({ items: ["a"] });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures, so a retry runs the operation again", async () => {
    const store = new InMemoryIdempotencyStore();
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce("ok");

    await expect(store.execute("k", operation)).rejects.toThrow("transient");
    expect(await store.isProcessed("k")).toBe(false);
    expect(await store.execute("k", operation)).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("expires results after their TTL and does not keep results with a TTL of 0", async () => {
    let now = 1_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    const store = new InMemoryIdempotencyStore();

    await store.execute("short", async () => "v1", 100);
    expect(await store.getResult("short")).toBe("v1");
    now += 100;
    expect(await store.isProcessed("short")).toBe(false);
    expect(await store.getResult("short")).toBeUndefined();

    await store.markProcessed("again", "v", 50);
    now += 50;
    expect(await store.getResult("again")).toBeUndefined();

    await store.markProcessed("pruned", "v", 10);
    now += 10;
    expect(await store.prune()).toBe(1);

    const operation = jest.fn(async () => "fresh");
    await store.execute("zero", operation, 0);
    await store.execute("zero", operation, 0);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("rejects new keys at capacity but still serves existing ones", async () => {
    const store = new InMemoryIdempotencyStore({ maxEntries: 1 });
    await store.execute("a", async () => 1);

    await expect(store.execute("b", async () => 2)).rejects.toThrow("Idempotency store capacity exceeded");
    expect(await store.execute("a", async () => 99)).toBe(1);
  });

  it("supports markProcessed, isProcessed, getResult, clear, and clearStore", async () => {
    const store = new InMemoryIdempotencyStore();
    const result = { n: 1 };

    await store.markProcessed("k", result);
    result.n = 2;

    expect(await store.isProcessed("k")).toBe(true);
    expect(await store.getResult("k")).toEqual({ n: 1 });
    expect(await store.isProcessed("missing")).toBe(false);
    expect(await store.clear("k")).toBe(true);
    expect(await store.clear("k")).toBe(false);

    await store.markProcessed("x", 1);
    await store.clearStore();
    expect(await store.isProcessed("x")).toBe(false);
  });

  it("uses a custom cloneValue for stored results", async () => {
    const cloneValue = jest.fn((value: unknown) => (typeof value === "object" && value ? { ...value, copied: true } : value));
    const store = new InMemoryIdempotencyStore({ cloneValue });

    expect(await store.execute("k", async () => ({ n: 1 }))).toEqual({ n: 1, copied: true });
    expect(cloneValue).toHaveBeenCalled();
  });

  it("retries only the completion step when it fails after the operation committed", async () => {
    const store = new InMemoryIdempotencyStore();
    const operation = jest.fn(async () => "committed");
    const complete = jest.fn()
      .mockRejectedValueOnce(new Error("publish failed"))
      .mockResolvedValueOnce(undefined);

    await expect(store.executeWithCompletion("k", async () => ({ result: await operation(), complete }))).rejects.toThrow("publish failed");
    expect(await store.isProcessed("k")).toBe(false);
    await expect(store.markProcessed("k", "other")).rejects.toThrow("Cannot replace");
    await expect(store.clear("k")).rejects.toThrow("Cannot clear");
    await expect(store.clearStore()).rejects.toThrow("committed completion is pending");

    expect(await store.executeWithCompletion("k", async () => ({ result: await operation(), complete }))).toBe("committed");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(await store.getResult("k")).toBe("committed");
  });

  it("refuses to clear the store while an operation is in progress", async () => {
    const store = new InMemoryIdempotencyStore();
    let release!: () => void;
    const pending = store.execute("k", () => new Promise<string>(resolve => { release = () => resolve("done"); }));
    await Promise.resolve();

    await expect(store.clearStore()).rejects.toThrow("operations are in progress");
    await expect(store.resolveUnknownCommit("k", { status: "not-committed" })).rejects.toThrow("in-progress key");
    release();
    expect(await pending).toBe("done");
  });

  describe("unknown commit outcomes", () => {
    const unknownCommit = (staged?: { result: unknown; complete?: () => Promise<void> }) =>
      new CommitOutcomeUnknownError(new Error("connection reset"), "k", staged);

    it("blocks retries until resolved and reruns the operation after not-committed", async () => {
      const store = new InMemoryIdempotencyStore();
      const operation = jest.fn()
        .mockRejectedValueOnce(unknownCommit())
        .mockResolvedValueOnce("second run");

      await expect(store.execute("k", operation)).rejects.toBeInstanceOf(CommitOutcomeUnknownError);
      await expect(store.execute("k", operation)).rejects.toBeInstanceOf(CommitOutcomeUnknownError);
      expect(await store.getResult("k")).toBeUndefined();
      expect(operation).toHaveBeenCalledTimes(1);

      await store.resolveUnknownCommit("k", { status: "not-committed" });
      expect(await store.execute("k", operation)).toBe("second run");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("uses the staged result when resolved as committed, running its completion", async () => {
      const store = new InMemoryIdempotencyStore();
      const complete = jest.fn(async () => {});
      await expect(store.execute("k", async () => { throw unknownCommit({ result: "staged", complete }); })).rejects.toThrow();

      await store.resolveUnknownCommit("k", { status: "committed" });
      expect(await store.isProcessed("k")).toBe(false);
      expect(await store.executeWithCompletion("k", async () => ({ result: "never" }))).toBe("staged");
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it("stores an explicit committed execution and rejects invalid resolutions", async () => {
      const store = new InMemoryIdempotencyStore();
      await expect(store.resolveUnknownCommit("k", { status: "not-committed" })).rejects.toThrow("no unknown commit");

      await expect(store.execute("k", async () => { throw unknownCommit(); })).rejects.toThrow();
      await expect(store.resolveUnknownCommit("k", { status: "committed" })).rejects.toThrow("requires an execution record");

      await store.resolveUnknownCommit("k", { status: "committed", execution: { result: "explicit" } });
      expect(await store.getResult("k")).toBe("explicit");
    });

    it("reconciles through the callback: unknown stays blocked, committed uses the staged result", async () => {
      const store = new InMemoryIdempotencyStore();
      await expect(store.execute("k", async () => { throw unknownCommit({ result: "staged" }); })).rejects.toThrow();
      const operation = jest.fn(async () => ({ result: "rerun" }));

      await expect(store.executeWithCompletion("k", operation, undefined, async () => ({ status: "unknown" }))).rejects.toBeInstanceOf(CommitOutcomeUnknownError);
      expect(await store.executeWithCompletion("k", operation, undefined, async () => ({ status: "committed" }))).toBe("staged");
      expect(operation).not.toHaveBeenCalled();
    });

    it("reconciles through the callback: not-committed reruns the operation", async () => {
      const store = new InMemoryIdempotencyStore();
      await expect(store.execute("k", async () => { throw unknownCommit(); })).rejects.toThrow();

      expect(await store.executeWithCompletion("k", async () => ({ result: "rerun" }), undefined, async () => ({ status: "not-committed" }))).toBe("rerun");
    });

    it("keeps both causes when the reconcile callback itself fails", async () => {
      const store = new InMemoryIdempotencyStore();
      await expect(store.execute("k", async () => { throw unknownCommit(); })).rejects.toThrow();

      const error = await store
        .executeWithCompletion("k", async () => ({ result: "x" }), undefined, async () => { throw new Error("storage unreachable"); })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(CommitOutcomeUnknownError);
      const cause = (error as CommitOutcomeUnknownError).cause as AggregateError;
      expect(cause).toBeInstanceOf(AggregateError);
      expect(cause.errors.map((e: Error) => e.message)).toEqual(["connection reset", "storage unreachable"]);
      await expect(store.execute("k", async () => "x")).rejects.toBe(error);
    });
  });
});
