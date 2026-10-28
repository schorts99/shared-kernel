import {
  Criteria,
  DomainEvent,
  Entity,
  InMemoryCommandBus,
  InMemoryDAO,
  InMemoryEventStore,
  InMemorySagaStateStore,
  InMemoryUnitOfWork,
  Saga,
  UUIDValue,
} from "../src";
import { NodeExecutionContext } from "../src/node";
import {
  registerTestMessages,
  TestDomainEvent,
  TestUUIDValue,
} from "./support/fixtures";

beforeAll(registerTestMessages);

describe("6. Saga Concurrency, Cross-Event Compensation, Store Isolation, and InMemoryDAO", () => {
  it("runs different sagaIds concurrently while serializing same-sagaId events and compensating across events", async () => {
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

    // Verify InMemoryEventStore isolation as well
    const eventStore = new InMemoryEventStore();
    const rawPrimitives = new TestDomainEvent("c-es", { id: "es-1" }, { id: "evt-es-1" }).toPrimitives();
    await eventStore.save(rawPrimitives);
    rawPrimitives.payload.id = "mutated";
    const allEvents = await eventStore.all();
    expect(allEvents[0]?.payload.id).toBe("es-1");
  });

  it("supports all Operators, soft delete/restore, entity isolation, and UnitOfWork transactions in InMemoryDAO", async () => {
    interface StoreModel {
      id: string;
      name: string;
      score: number;
      tags: string[];
      location: { latitude: number; longitude: number };
      deletedAt?: string | null;
    }

    class StoreEntity extends Entity<UUIDValue, StoreModel> {
      constructor(
        id: UUIDValue,
        public name: string,
        public score: number,
        public tags: string[],
        public location: { latitude: number; longitude: number },
        public deletedAt: string | null = null,
      ) {
        super(id);
      }

      toPrimitives(): StoreModel {
        return {
          id: this.id.value,
          name: this.name,
          score: this.score,
          tags: [...this.tags],
          location: { ...this.location },
          deletedAt: this.deletedAt,
        };
      }
    }

    const dao = new InMemoryDAO<StoreModel, StoreEntity>("SOFT");

    const nycId = new TestUUIDValue("123e4567-e89b-12d3-a456-426614174001");
    const laId = new TestUUIDValue("123e4567-e89b-12d3-a456-426614174002");

    const nycStore = new StoreEntity(
      nycId,
      "NYC Flagship",
      95,
      ["flagship", "east-coast"],
      { latitude: 40.7128, longitude: -74.006 },
    );
    const laStore = new StoreEntity(
      laId,
      "LA Hub",
      80,
      ["west-coast", "outlet"],
      { latitude: 34.0522, longitude: -118.2437 },
    );

    // 1. Transactional UnitOfWork rollback discards uncommitted writes
    const uowRollback = new InMemoryUnitOfWork();
    await uowRollback.begin();
    await dao.create(nycStore, uowRollback);
    expect(await dao.count(uowRollback)).toBe(1);
    expect(await dao.count()).toBe(0);
    await uowRollback.rollback();
    expect(await dao.count()).toBe(0);

    // 2. Transactional UnitOfWork commit persists writes
    const uowCommit = new InMemoryUnitOfWork();
    await uowCommit.begin();
    await dao.saveMany([nycStore, laStore], uowCommit);
    expect(await dao.count()).toBe(0);
    await uowCommit.commit();
    expect(await dao.count()).toBe(2);

    // 3. Entity isolation on read
    const fetchedNyc = await dao.findByID(nycId.value);
    expect(fetchedNyc).not.toBeNull();
    fetchedNyc!.name = "Tampered";
    fetchedNyc!.tags.push("tampered");
    const fetchedNycAgain = await dao.findByID(nycId.value);
    expect(fetchedNycAgain?.name).toBe("NYC Flagship");
    expect(fetchedNycAgain?.tags).toEqual(["flagship", "east-coast"]);

    // 4. Criteria operators: BETWEEN, ARRAY_CONTAINS, ARRAY_CONTAINS_ANY, GEO_RADIUS
    const betweenResults = await dao.search(Criteria.none().where("score", "BETWEEN", [90, 100]));
    expect(betweenResults.map(e => e.name)).toEqual(["NYC Flagship"]);

    const containsResults = await dao.search(
      Criteria.none().where("tags", "ARRAY_CONTAINS", "flagship"),
    );
    expect(containsResults.map(e => e.name)).toEqual(["NYC Flagship"]);

    const containsAnyResults = await dao.search(
      Criteria.none().where("tags", "ARRAY_CONTAINS_ANY", ["outlet", "non-existent"]),
    );
    expect(containsAnyResults.map(e => e.name)).toEqual(["LA Hub"]);

    const geoResults = await dao.search(
      Criteria.none().where("location", "GEO_RADIUS", {
        lat: 40.758,
        lng: -73.9855,
        radius: 15_000, // 15 km around Times Square
      }),
    );
    expect(geoResults.map(e => e.name)).toEqual(["NYC Flagship"]);

    // 5. Soft delete & restore
    await dao.deleteByID(laId.value);
    expect(await dao.count()).toBe(1);
    expect(await dao.findByID(laId.value)).toBeNull();

    await dao.restore(laStore);
    expect(await dao.count()).toBe(2);
    expect((await dao.findByID(laId.value))?.name).toBe("LA Hub");
  });
});
