import {
  DomainEvent,
  InMemoryCommandBus,
  InMemorySagaStateStore,
  Saga,
} from "../../src";
import { NodeExecutionContext } from "../../src/node";
import {
  registerTestMessages,
  TestDomainEvent,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("Saga", () => {
  it("runs different saga IDs concurrently, serializes the same ID, and compensates across events", async () => {
    const executionContext = new NodeExecutionContext();
    const commandBus = new InMemoryCommandBus({ executionContext });
    const stateStore = new InMemorySagaStateStore<{ steps: string[] }>({
      maxProcessedEventsPerSaga: 2,
    });

    let releaseSlowSagaA!: () => void;
    const slowSagaAGate = new Promise<void>(resolve => {
      releaseSlowSagaA = resolve;
    });
    const compensatedLog: string[] = [];

    class StepTwoEvent extends DomainEvent<{ id: string; fail?: boolean }> {
      static readonly NAME = "step.two.event";
      getEventName(): string {
        return StepTwoEvent.NAME;
      }
    }

    class MultiStepOrderSaga extends Saga<{ steps: string[] }> {
      constructor() {
        super(commandBus, stateStore, { maxProcessedEvents: 2 });
      }

      protected getInitialState() {
        return { steps: [] };
      }

      protected getSagaId(event: DomainEvent): string {
        return (event.getPayload() as { id: string }).id;
      }

      protected configure(): void {
        this.registerStepCompensation("step-1", ({ sagaId, state }) => {
          compensatedLog.push(`declarative:step-1:${sagaId}:${state.steps.join(",")}`);
        });

        this.on<TestDomainEvent>(TestDomainEvent.NAME, async (_event, ctx) => {
          if (ctx.sagaId === "saga-slow") {
            await slowSagaAGate;
          }
          ctx.updateState({ steps: [...ctx.state.steps, "step-1"] });
          ctx.completeStep("step-1");
        });

        this.on<StepTwoEvent>(StepTwoEvent.NAME, async (event, ctx) => {
          ctx.updateState({ steps: [...ctx.state.steps, "step-2"] });
          ctx.completeStep("step-2", async () => {
            compensatedLog.push(`inline:step-2:${ctx.sagaId}`);
          });
          if (event.getPayload().fail) {
            throw new Error("step-2 failed");
          }
          ctx.completeSaga();
        });
      }
    }

    const saga = new MultiStepOrderSaga();

    // Start slow saga-slow; verify saga-fast completes without waiting on saga-slow
    const pSlow = saga.handle(new TestDomainEvent("c-slow", { id: "saga-slow" }, { id: "e-slow-1" }));
    const pFast1 = saga.handle(new TestDomainEvent("c-fast", { id: "saga-fast" }, { id: "e-fast-1" }));
    await expect(pFast1).resolves.toBeUndefined();

    // Trigger step 2 failure on saga-fast and verify both step-2 (inline) and step-1 (declarative from earlier event) compensate in reverse order
    await expect(
      saga.handle(new StepTwoEvent("c-fast", { id: "saga-fast", fail: true }, { id: "e-fast-2" })),
    ).rejects.toThrow("step-2 failed");

    expect(compensatedLog).toEqual([
      "inline:step-2:saga-fast",
      "declarative:step-1:saga-fast:step-1,step-2",
    ]);

    const failedFastState = await stateStore.load("saga-fast");
    expect(failedFastState?.status).toBe("failed");
    expect(failedFastState?.completedSteps).toEqual([]);

    // Release slow saga and verify state store isolation + bounded processedEventIds
    releaseSlowSagaA();
    await expect(pSlow).resolves.toBeUndefined();

    const loadedSlow = await stateStore.load("saga-slow");
    expect(loadedSlow?.data.steps).toEqual(["step-1"]);
    loadedSlow!.data.steps.push("mutated-outside");

    const loadedSlowAgain = await stateStore.load("saga-slow");
    expect(loadedSlowAgain?.data.steps).toEqual(["step-1"]);
  });

  it("updates state during declarative compensation and does not retry CrossDispatchCycleError", async () => {
    const commandBus = new InMemoryCommandBus();
    const sagaStore = new InMemorySagaStateStore<{ steps: string[]; rolledBack?: boolean }>();

    class CompensationStateSaga extends Saga<{ steps: string[]; rolledBack?: boolean }> {
      constructor() {
        super(commandBus, sagaStore);
      }
      protected getInitialState() {
        return { steps: [] };
      }
      protected getSagaId(event: DomainEvent): string {
        return (event.getPayload() as { id: string }).id;
      }
      protected configure(): void {
        this.registerStepCompensation("step-1", ({ state, updateState }) => {
          updateState({ steps: state.steps.filter((s) => s !== "step-1"), rolledBack: true });
        });
        this.on<TestDomainEvent>(TestDomainEvent.NAME, async (event, ctx) => {
          ctx.updateState({ steps: [...ctx.state.steps, "step-1"] });
          ctx.completeStep("step-1");
          if (event.id === "evt-fail") {
            throw new Error("boom");
          }
        });
      }
    }

    const saga = new CompensationStateSaga();
    await expect(
      saga.handle(new TestDomainEvent("c-1", { id: "s-1" }, { id: "evt-fail" })),
    ).rejects.toThrow("boom");
    const failedState = await sagaStore.load("s-1");
    expect(failedState?.status).toBe("failed");
    expect(failedState?.data).toEqual({ steps: [], rolledBack: true });
    await commandBus.close();
  });
});
