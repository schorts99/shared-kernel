import {
  ConsoleLogger,
} from "../../src";

describe("ConsoleLogger", () => {
  it("serializes circular references and BigInt values safely", () => {
    const consoleSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    try {
      const consoleLogger = new ConsoleLogger("info");
      const circular: Record<string, unknown> = { count: BigInt(42) };
      circular.self = circular;
      expect(() => consoleLogger.info("circular context", circular)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('"count":"42"');
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('"[Circular]"');
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
