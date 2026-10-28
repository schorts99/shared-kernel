import {
  InMemoryEventBus,
  InMemoryEventStore,
} from "../../src";
import type {
  EventSubscriber,
} from "../../src";
import { NodeExecutionContext } from "../../src/node";
import {
  registerTestMessages,
  TestDomainEvent,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("InMemoryEventBus", () => {
  it("keeps shared in-flight delivery alive when one caller cancels and cancels when all callers abort", async () => {
    const executionContext = new NodeExecutionContext();
    const eventBus = new InMemoryEventBus(
      new InMemoryEventStore(),
      { maxConcurrency: 1 },
      undefined,
      undefined,
      executionContext,
    );

    let finishDelivery!: () => void;
    const gate = new Promise<void>(resolve => {
      finishDelivery = resolve;
    });
    const delivered: string[] = [];

    const subscriber: EventSubscriber<TestDomainEvent> = {
      getName: () => "shared-sub",
      subscribedTo: () => [TestDomainEvent.NAME],
      handle: async event => {
        await gate;
        delivered.push(event.id);
      },
    };
    eventBus.subscribe(TestDomainEvent.NAME, subscriber);

    const sharedEvent = new TestDomainEvent("corr-shared", { id: "shared" }, { id: "evt-shared-1" });
    const c1 = new AbortController();
    const c2 = new AbortController();

    const p1 = eventBus.publish(sharedEvent, { signal: c1.signal });
    const p2 = eventBus.publish(sharedEvent, { signal: c2.signal });

    // Caller 1 aborts; Caller 1 rejects, but Caller 2 still completes once gate opens
    c1.abort(new Error("caller-1 aborted"));
    await expect(p1).rejects.toThrow("caller-1 aborted");

    finishDelivery();
    await expect(p2).resolves.toBeUndefined();
    expect(delivered).toEqual(["evt-shared-1"]);

    await eventBus.close();
  });
});
