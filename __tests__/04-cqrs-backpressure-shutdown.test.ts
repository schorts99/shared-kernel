import {
  AbstractCommandHandler,
  InMemoryCommandBus,
  InMemoryEventBus,
  InMemoryEventStore,
} from "../src";
import type {
  EventSubscriber,
} from "../src";
import { NodeExecutionContext } from "../src/node";
import {
  registerTestMessages,
  TestCommand,
  TestDomainEvent,
} from "./support/fixtures";

beforeAll(registerTestMessages);

describe("4. Backpressure and shutdown", () => {
  it("enforces queue capacity, queued cancellation, admission timeouts, and drain/close waiting for timed-out work", async () => {
    const executionContext = new NodeExecutionContext();
    const commandBus = new InMemoryCommandBus({ executionContext });
    commandBus.setConfig({
      maxConcurrency: 1,
      maxQueueSize: 1,
      timeout: 30,
      queueTimeout: 80,
    });

    let finishSlowHandler!: () => void;
    let slowHandlerSettled = false;
    const slowGate = new Promise<void>(resolve => {
      finishSlowHandler = () => {
        slowHandlerSettled = true;
        resolve();
      };
    });

    class SlowCommandHandler extends AbstractCommandHandler<TestCommand, string> {
      async execute(command: TestCommand): Promise<string> {
        const id = command.getPayload().id;
        if (id === "slow") {
          await slowGate;
        }
        return `done:${id}`;
      }
    }

    commandBus.register(TestCommand.TYPE, new SlowCommandHandler());

    // 1. Start slow command; caller times out at 30ms, but underlying execution continues holding the slot
    const pSlow = commandBus.dispatch(new TestCommand("c-1", { id: "slow" }));
    await expect(pSlow).rejects.toThrow("Bus dispatch timed out");
    expect(slowHandlerSettled).toBe(false);

    // 2. Queue one command (fills maxQueueSize: 1) with an AbortSignal, and verify a second queued command rejects on capacity
    const abortController = new AbortController();
    const pQueued = commandBus.dispatch(
      new TestCommand("c-2", { id: "queued" }),
      { signal: abortController.signal },
    );
    await expect(
      commandBus.dispatch(new TestCommand("c-3", { id: "overflow" })),
    ).rejects.toThrow("Bus dispatch queue capacity exceeded");

    // 3. Cancel the queued command and verify it frees queue capacity immediately
    abortController.abort(new Error("caller cancelled queued command"));
    await expect(pQueued).rejects.toThrow("caller cancelled queued command");

    // 4. Queue another command that will run once the slow handler finishes, and call close()
    const pDrained = commandBus.dispatch<TestCommand, string>(new TestCommand("c-4", { id: "after-slow" }));
    let closed = false;
    const closePromise = commandBus.close().then(() => {
      closed = true;
    });

    // New top-level dispatches are rejected after close()
    await expect(commandBus.dispatch(new TestCommand("c-5", { id: "rejected-after-close" }))).rejects.toThrow(
      "Bus is closed to new dispatches",
    );

    // close() has not resolved yet because the timed-out slow handler is still running
    await new Promise(resolve => setTimeout(resolve, 15));
    expect(closed).toBe(false);

    // Finish the slow handler; queued work runs and close() resolves
    finishSlowHandler();
    await expect(pDrained).resolves.toBe("done:after-slow");
    await closePromise;
    expect(closed).toBe(true);
  });

  it("isolates shared in-flight event delivery from single-caller cancellation while cancelling when all callers abort", async () => {
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
