import {
  InMemoryPubSub,
  Logger,
} from "../../src";

describe("InMemoryPubSub", () => {
  it("logs handler errors through the Logger contract", async () => {
    const loggedErrors: Array<{ message: string; context?: Record<string, unknown> }> = [];
    const loggedInfos: Array<{ message: string; context?: Record<string, unknown> }> = [];

    class TestLogger extends Logger {
      log() {}
      info(message: string, context?: Record<string, unknown>) {
        loggedInfos.push({ message, ...(context ? { context } : {}) });
      }
      debug() {}
      warn() {}
      error(message: string, context?: Record<string, unknown>) {
        loggedErrors.push({ message, ...(context ? { context } : {}) });
      }
    }

    const logger = new TestLogger();
    const pubSub = new InMemoryPubSub({ logger });

    await pubSub.subscribe("orders", "created", async () => {
      throw new Error("handler failed");
    });
    await pubSub.publish("orders", "created", { orderId: "123" });

    expect(loggedErrors).toHaveLength(1);
    expect(loggedErrors[0]?.message).toBe("Error in handler for orders:created");
  });

  it("isolates payloads and supports wildcard subscriptions", async () => {
    const pubSub = new InMemoryPubSub();
    const receivedByExact: Array<{ count: number }> = [];
    const receivedByChannelWildcard: Array<{ count: number }> = [];
    const receivedByGlobalWildcard: Array<{ count: number }> = [];

    await pubSub.subscribe<{ count: number }>("orders", "created", payload => {
      payload.count = 999; // mutate in first subscriber
      receivedByExact.push(payload);
    });
    await pubSub.subscribe<{ count: number }>("orders", "*", payload => {
      receivedByChannelWildcard.push(payload);
    });
    await pubSub.subscribe<{ count: number }>("*", "*", payload => {
      receivedByGlobalWildcard.push(payload);
    });

    await pubSub.publish("orders", "created", { count: 1 });

    expect(receivedByExact).toEqual([{ count: 999 }]);
    expect(receivedByChannelWildcard).toEqual([{ count: 1 }]);
    expect(receivedByGlobalWildcard).toEqual([{ count: 1 }]);
  });
});
