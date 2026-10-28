import {
  CompositeLogger,
  InMemoryLogger,
  NullLogger,
  ScopedLogger,
} from "../src";

describe("ScopedLogger", () => {
  it("merges its base context into every level, letting call context win", () => {
    const sink = new InMemoryLogger();
    const scoped = sink.child({ service: "orders", requestId: "r-1" });

    scoped.debug("debugging", { step: 1 });
    scoped.info("started");
    scoped.log("logged");
    scoped.warn("slow", { requestId: "r-2" });
    scoped.error("failed", { step: 3 }, new Error("boom"));

    const entries = sink.getEntries();
    expect(scoped).toBeInstanceOf(ScopedLogger);
    expect(entries.map(e => e.level)).toEqual(["debug", "info", "log", "warn", "error"]);
    expect(entries[0]?.context).toEqual({ service: "orders", requestId: "r-1", step: 1 });
    expect(entries[1]?.context).toEqual({ service: "orders", requestId: "r-1" });
    expect(entries[3]?.context).toEqual({ service: "orders", requestId: "r-2" });
    expect(entries[4]?.error?.message).toBe("boom");
  });

  it("flattens nested children onto the original base logger", () => {
    const sink = new InMemoryLogger();
    const nested = sink.child({ a: 1 }).child({ b: 2 });

    nested.info("nested");

    expect(nested).toBeInstanceOf(ScopedLogger);
    expect(sink.getEntries()[0]?.context).toEqual({ a: 1, b: 2 });
  });
});

describe("CompositeLogger", () => {
  it("fans every level out to all loggers", () => {
    const first = new InMemoryLogger();
    const second = new InMemoryLogger("warn");
    const composite = new CompositeLogger([first, second, new NullLogger()]);
    const error = new Error("down");

    composite.debug("d");
    composite.info("i", { k: "v" });
    composite.log("l");
    composite.warn("w");
    composite.error("e", undefined, error);

    expect(first.getEntries().map(e => e.message)).toEqual(["d", "i", "l", "w", "e"]);
    expect(first.getByLevel("info")[0]?.context).toEqual({ k: "v" });
    expect(second.getEntries().map(e => e.message)).toEqual(["w", "e"]);
    expect(second.getByLevel("error")[0]?.error?.message).toBe("down");
  });
});

describe("NullLogger", () => {
  it("accepts every level without side effects", () => {
    const logger = new NullLogger();

    expect(() => {
      logger.debug();
      logger.info();
      logger.log();
      logger.warn();
      logger.error();
      logger.child({ a: 1 }).info("ignored");
    }).not.toThrow();
  });
});
