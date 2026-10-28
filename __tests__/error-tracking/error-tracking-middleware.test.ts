import {
  ErrorTracker,
  ErrorTrackingMiddleware,
  InMemoryErrorStore,
  InMemoryEventBus,
  InMemoryEventStore,
} from "../../src";
import { NodeExecutionContext } from "../../src/node";
import {
  registerTestMessages,
  TestDomainEvent,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("ErrorTrackingMiddleware", () => {
  it("tracks failed event deliveries on the event bus", async () => {
    const executionContext = new NodeExecutionContext();
    const errorStore = new InMemoryErrorStore();
    const errorTracker = new ErrorTracker(errorStore, { upload: async () => {} });
    const middleware = new ErrorTrackingMiddleware(errorTracker);

    const eventBus = new InMemoryEventBus(
      new InMemoryEventStore(),
      { maxRetries: 0 },
      undefined,
      undefined,
      executionContext,
    );
    eventBus.use(middleware);

    eventBus.subscribe(TestDomainEvent.NAME, {
      getName: () => "failing-sub",
      subscribedTo: () => [TestDomainEvent.NAME],
      handle: async () => {
        throw new Error("event subscriber failed");
      },
    });

    await expect(
      eventBus.publish(new TestDomainEvent("corr-err-mw", { id: "e-mw" }, { id: "evt-mw-1" })),
    ).rejects.toThrow("event subscriber failed");

    const tracked = await errorStore.all();
    expect(tracked).toHaveLength(1);
    expect(tracked[0]?.reason).toBe(`Failed to execute event: ${TestDomainEvent.NAME}`);
    expect(tracked[0]?.context?.requestType).toBe("event");
    await eventBus.close();
  });
});
