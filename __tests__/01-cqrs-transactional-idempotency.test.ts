import {
  AbstractCommandHandler,
  AsyncUnitOfWorkRunner,
  CommitOutcomeUnknownError,
  InMemoryCache,
  InMemoryCommandBus,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemoryIdempotencyStore,
  InMemoryTransactionalIdempotencyAdapter,
  InMemoryUnitOfWork,
  retry,
} from "../src";
import type {
  CommandHandlerContext,
  UnitOfWork,
} from "../src";
import { NodeExecutionContext } from "../src/node";
import {
  registerTestMessages,
  TestCommand,
  TestDomainEvent,
} from "./support/fixtures";

beforeAll(registerTestMessages);

describe("1. Ambiguous commits & transactional idempotency", () => {
  it("blocks retries on CommitOutcomeUnknownError until reconciled and preserves staged post-commit effects", async () => {
    const executionContext = new NodeExecutionContext();
    const idempotencyStore = new InMemoryIdempotencyStore({ executionContext });
    const eventStore = new InMemoryEventStore();
    const eventBus = new InMemoryEventBus(eventStore, {}, undefined, undefined, executionContext);
    const cache = new InMemoryCache<string>();
    await cache.set("order:1", "stale", 60_000, ["order:1"]);

    const publishedEvents: string[] = [];
    eventBus.subscribe(TestDomainEvent.NAME, {
      getName: () => "test-subscriber",
      handle: async (event: TestDomainEvent) => {
        publishedEvents.push(event.getPayload().id);
      },
    });

    let shouldFailCommit = true;
    let executions = 0;

    const commandBus = new InMemoryCommandBus({
      executionContext,
      eventBus,
      createUnitOfWork: () => {
        const uow = new InMemoryUnitOfWork();
        const origCommit = uow.commit.bind(uow);
        uow.commit = async () => {
          if (shouldFailCommit) {
            throw new Error("socket hang up during commit ACK");
          }
          await origCommit();
        };
        return uow;
      },
    });
    commandBus.setConfig({ transactional: true, autoPublishEvents: true });

    class CreateOrderHandler extends AbstractCommandHandler<TestCommand, { orderId: string }> {
      constructor() {
        super({
          idempotent: true,
          idempotencyStore,
          cache,
        });
      }

      async execute(command: TestCommand, context: CommandHandlerContext): Promise<{ orderId: string }> {
        executions++;
        const id = command.getPayload().id;
        context.events.push(new TestDomainEvent("corr-1", { id }, { id: "evt-1" }));
        return { orderId: id };
      }

      getInvalidationTags(command: TestCommand): string[] {
        return [`order:${command.getPayload().id}`];
      }
    }

    commandBus.register(TestCommand.TYPE, new CreateOrderHandler());

    const cmd = new TestCommand("corr-1", { id: "1" }, { id: "cmd-1", createdAt: new Date(1000) });
    await expect(commandBus.dispatch(cmd)).rejects.toThrow(CommitOutcomeUnknownError);
    expect(executions).toBe(1);
    expect(publishedEvents).toEqual([]);
    expect(await cache.get("order:1")).toBe("stale");

    // Retrying while still unreconciled is blocked without re-running the handler
    await expect(commandBus.dispatch(cmd)).rejects.toThrow(CommitOutcomeUnknownError);
    expect(executions).toBe(1);

    // Reconcile as committed without needing to manually supply internal bus completion closures
    const key = new CreateOrderHandler().getIdempotencyKey(cmd)!;
    await idempotencyStore.resolveUnknownCommit(key, { status: "committed" });

    // Next retry runs the staged post-commit completion (cache invalidation + event publication) and returns the result
    const recovered = await commandBus.dispatch<TestCommand, { orderId: string }>(cmd);
    expect(recovered).toEqual({ orderId: "1" });
    expect(executions).toBe(1);
    expect(publishedEvents).toEqual(["1"]);
    expect(await cache.get("order:1")).toBeUndefined();
  });

  it("automatically reconciles on retry when TransactionalIdempotencyAdapter resolves a previously unknown commit", async () => {
    const executionContext = new NodeExecutionContext();
    const idempotencyStore = new InMemoryIdempotencyStore({ executionContext });
    const transactionalIdempotency = new InMemoryTransactionalIdempotencyAdapter();
    const eventBus = new InMemoryEventBus(new InMemoryEventStore(), {}, undefined, undefined, executionContext);

    const published: string[] = [];
    eventBus.subscribe(TestDomainEvent.NAME, {
      getName: () => "sub",
      handle: async (event: TestDomainEvent) => {
        published.push(event.getPayload().id);
      },
    });

    let failCommitOnce = true;
    let handlerRuns = 0;

    class Handler extends AbstractCommandHandler<TestCommand, { ok: boolean }> {
      constructor() {
        super({ idempotent: true, idempotencyStore });
      }

      async execute(command: TestCommand, context: CommandHandlerContext): Promise<{ ok: boolean }> {
        handlerRuns++;
        context.events.push(
          new TestDomainEvent("corr-auto", { id: command.getPayload().id }, { id: "evt-auto-1" }),
        );
        return { ok: true };
      }
    }

    const handler = new Handler();
    const cmd = new TestCommand("corr-auto", { id: "42" }, { id: "cmd-auto", createdAt: new Date(2000) });
    const key = handler.getIdempotencyKey(cmd)!;

    const commandBus = new InMemoryCommandBus({
      executionContext,
      eventBus,
      transactionalIdempotency,
      createUnitOfWork: () => {
        const uow = new InMemoryUnitOfWork();
        const origCommit = uow.commit.bind(uow);
        uow.commit = async () => {
          if (failCommitOnce) {
            failCommitOnce = false;
            throw new CommitOutcomeUnknownError(new Error("timeout waiting for commit ack"), key);
          }
          await origCommit();
        };
        return uow;
      },
    });
    commandBus.setConfig({ transactional: true, autoPublishEvents: true });
    commandBus.register(TestCommand.TYPE, handler);

    // Attempt 1 fails with unknown commit outcome
    await expect(commandBus.dispatch(cmd)).rejects.toThrow(CommitOutcomeUnknownError);
    expect(handlerRuns).toBe(1);

    // Attempt 2 while adapter still reports "unknown" remains blocked
    await expect(commandBus.dispatch(cmd)).rejects.toThrow(CommitOutcomeUnknownError);
    expect(handlerRuns).toBe(1);

    // Durable storage confirms transaction actually committed
    transactionalIdempotency.reconcile(key, { status: "committed" });

    // Attempt 3 automatically reconciles via durable.resolve(key), publishes events, and returns result
    const result = await commandBus.dispatch<TestCommand, { ok: boolean }>(cmd);
    expect(result).toEqual({ ok: true });
    expect(handlerRuns).toBe(1);
    expect(published).toEqual(["42"]);
  });

  it("supports AsyncUnitOfWorkRunner commit outcome reconciliation hook", async () => {
    class ReconcilingRunner extends AsyncUnitOfWorkRunner {
      constructor(private readonly resolution: "committed" | "not-committed" | "unknown") {
        super();
      }

      protected createUnitOfWork(): UnitOfWork {
        const uow = new InMemoryUnitOfWork();
        uow.commit = async () => {
          throw new Error("ambiguous network drop");
        };
        return uow;
      }

      protected async resolveCommitOutcome(): Promise<"committed" | "not-committed" | "unknown"> {
        return this.resolution;
      }
    }

    await expect(new ReconcilingRunner("committed").run(async () => "ok")).resolves.toBe("ok");
    await expect(new ReconcilingRunner("not-committed").run(async () => "ok")).rejects.toThrow("ambiguous network drop");
    await expect(new ReconcilingRunner("unknown").run(async () => "ok")).rejects.toThrow(CommitOutcomeUnknownError);
  });
});
