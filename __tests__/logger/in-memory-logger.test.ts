import {
  InMemoryLogger,
} from "../../src";

describe("InMemoryLogger", () => {
  it("filters by level, isolates context, and clears entries", () => {
    const memLogger = new InMemoryLogger("info");
    memLogger.debug("ignored debug");
    const mutableCtx = { requestId: "req-1" };
    memLogger.info("handled request", mutableCtx);
    mutableCtx.requestId = "mutated";

    expect(memLogger.getEntries()).toHaveLength(1);
    expect(memLogger.getByLevel("info")[0]?.context).toEqual({ requestId: "req-1" });
    memLogger.clear();
    expect(memLogger.getEntries()).toHaveLength(0);
  });
});
