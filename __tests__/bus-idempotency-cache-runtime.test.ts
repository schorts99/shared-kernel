import {
  AbstractCommand,
  AbstractCommandHandler,
  AbstractQuery,
  AbstractQueryHandler,
  AggregateRoot,
  AsyncUnitOfWorkRunner,
  BaseValueObject,
  CommandRegistry,
  CommitOutcomeUnknownError,
  CoordinatesValue,
  Criteria,
  CrossDispatchCycleError,
  DateValue,
  DomainEvent,
  DomainEventRegistry,
  EmailValue,
  Entity,
  EntityRegistry,
  InMemoryCache,
  InMemoryCommandBus,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemoryIdempotencyStore,
  InMemoryQueryBus,
  InMemorySagaStateStore,
  InMemoryTransactionalIdempotencyAdapter,
  InMemoryUnitOfWork,
  QueryRegistry,
  Result,
  Saga,
  SlugValue,
  URLValue,
  UUIDValue,
} from "../src";
import type {
  CommandHandlerContext,
  DomainEventMetadata,
  EventSubscriber,
  QueryHandlerContext,
  UnitOfWork,
} from "../src";
import { NodeExecutionContext } from "../src/node";

class TestCommand extends AbstractCommand<{ id: string; value?: string }> {
  static readonly TYPE = "test.command";

  getType(): string {
    return TestCommand.TYPE;
  }

  getPayload() {
    return this.payload;
  }
}

class SecondaryCommand extends AbstractCommand<{ id: string }> {
  static readonly TYPE = "secondary.command";

  getType(): string {
    return SecondaryCommand.TYPE;
  }

  getPayload() {
    return this.payload;
  }
}

class TestQuery extends AbstractQuery<{ id: string }> {
  static readonly TYPE = "test.query";

  getType(): string {
    return TestQuery.TYPE;
  }

  getPayload() {
    return this.payload;
  }
}

class TestDomainEvent extends DomainEvent<{ id: string }> {
  static readonly NAME = "test.event";

  constructor(
    correlationId: string,
    payload: { id: string },
    customMetadata?: Partial<DomainEventMetadata>,
  ) {
    super(correlationId, payload, customMetadata);
  }

  getEventName(): string {
    return TestDomainEvent.NAME;
  }

  getPayload() {
    return this.payload;
  }
}

class MoneyValue extends BaseValueObject<{ amount: number; currency: string }> {
  readonly valueType = "Money";
  readonly attributeName = "price";

  get isValid(): boolean {
    return Number.isFinite(this.value.amount) && this.value.currency.length === 3;
  }

  override equals(other: unknown): boolean {
    return (
      other instanceof MoneyValue &&
      this.isValid &&
      other.isValid &&
      this.value.amount === other.value.amount &&
      this.value.currency === other.value.currency
    );
  }
}

class OrderEntity extends Entity<UUIDValue, { id: string; total: number; items: string[] }> {
  constructor(
    id: UUIDValue,
    public total: number,
    public items: string[],
  ) {
    super(id);
  }

  toPrimitives() {
    return {
      id: this.id.value,
      total: this.total,
      items: [...this.items],
    };
  }
}

beforeAll(() => {
  CommandRegistry.register(TestCommand.TYPE, TestCommand);
  CommandRegistry.register(SecondaryCommand.TYPE, SecondaryCommand);
  QueryRegistry.register(TestQuery.TYPE, TestQuery);
  DomainEventRegistry.register(TestDomainEvent.NAME, TestDomainEvent);
});

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

describe("2. Cross-dispatch cycles & full dependency graph detection", () => {
  it("detects cross-bus dispatch cycles (Command -> Query -> Command) immediately", async () => {
    const executionContext = new NodeExecutionContext();
    const commandBus = new InMemoryCommandBus({ executionContext });
    const queryBus = new InMemoryQueryBus({ executionContext });

    class CyclicCommandHandler extends AbstractCommandHandler<TestCommand, string> {
      async execute(command: TestCommand): Promise<string> {
        return queryBus.dispatch(new TestQuery("corr-cycle", { id: command.getPayload().id }));
      }
    }

    class CyclicQueryHandler extends AbstractQueryHandler<TestQuery, string> {
      async execute(query: TestQuery): Promise<string> {
        return commandBus.dispatch(new TestCommand("corr-cycle", { id: query.getPayload().id }));
      }
    }

    commandBus.register(TestCommand.TYPE, new CyclicCommandHandler());
    queryBus.register(TestQuery.TYPE, new CyclicQueryHandler());

    await expect(commandBus.dispatch(new TestCommand("corr-cycle", { id: "1" }))).rejects.toThrow(
      CrossDispatchCycleError,
    );
  });

  it("detects diamond / mutual wait cycles across shared in-flight idempotency work", async () => {
    const executionContext = new NodeExecutionContext();
    const idempotencyStore = new InMemoryIdempotencyStore({ executionContext });
    const commandBus = new InMemoryCommandBus({ executionContext });

    let releaseAStarted!: () => void;
    let releaseBStarted!: () => void;
    const aStarted = new Promise<void>(resolve => { releaseAStarted = resolve; });
    const bStarted = new Promise<void>(resolve => { releaseBStarted = resolve; });

    const cmdA = new TestCommand("corr-a", { id: "A" }, { id: "fixed-a", createdAt: new Date(1000) });
    const cmdB = new SecondaryCommand("corr-b", { id: "B" }, { id: "fixed-b", createdAt: new Date(1000) });

    class HandlerA extends AbstractCommandHandler<TestCommand, string> {
      constructor() {
        super({ idempotent: true, idempotencyStore });
      }

      async execute(command: TestCommand): Promise<string> {
        if (command.getPayload().id === "A") {
          releaseAStarted();
          await bStarted;
          return commandBus.dispatch(cmdB);
        }
        return "done-A";
      }
    }

    class HandlerB extends AbstractCommandHandler<SecondaryCommand, string> {
      constructor() {
        super({ idempotent: true, idempotencyStore });
      }

      async execute(command: SecondaryCommand): Promise<string> {
        if (command.getPayload().id === "B") {
          releaseBStarted();
          await aStarted;
          return commandBus.dispatch(cmdA);
        }
        return "done-B";
      }
    }

    commandBus.register(TestCommand.TYPE, new HandlerA());
    commandBus.register(SecondaryCommand.TYPE, new HandlerB());

    const results = await Promise.allSettled([
      commandBus.dispatch(cmdA),
      commandBus.dispatch(cmdB),
    ]);

    const rejected = results.find(r => r.status === "rejected");
    expect(rejected?.status).toBe("rejected");
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(CrossDispatchCycleError);
  });

  it("detects cross-bus concurrency pool exhaustion cycles immediately", async () => {
    const executionContext = new NodeExecutionContext();
    const commandBus = new InMemoryCommandBus({ executionContext });
    const queryBus = new InMemoryQueryBus({ executionContext });
    commandBus.setConfig({ maxConcurrency: 1 });
    queryBus.setConfig({ maxConcurrency: 1 });

    let commandEntered!: () => void;
    let queryEntered!: () => void;
    const onCommandEntered = new Promise<void>(r => { commandEntered = r; });
    const onQueryEntered = new Promise<void>(r => { queryEntered = r; });

    class CmdHandler extends AbstractCommandHandler<TestCommand, string> {
      async execute(command: TestCommand): Promise<string> {
        if (command.getPayload().id === "1") {
          commandEntered();
          await onQueryEntered;
          return queryBus.dispatch(new TestQuery("c", { id: "2" }));
        }
        return "cmd-2";
      }
    }

    class QryHandler extends AbstractQueryHandler<TestQuery, string> {
      async execute(query: TestQuery): Promise<string> {
        if (query.getPayload().id === "1") {
          queryEntered();
          await onCommandEntered;
          return commandBus.dispatch(new TestCommand("c", { id: "2" }));
        }
        return "qry-2";
      }
    }

    commandBus.register(TestCommand.TYPE, new CmdHandler());
    queryBus.register(TestQuery.TYPE, new QryHandler());

    const results = await Promise.allSettled([
      commandBus.dispatch(new TestCommand("c1", { id: "1" })),
      queryBus.dispatch(new TestQuery("q1", { id: "1" })),
    ]);

    const rejected = results.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
    expect(rejected).toBeDefined();
    expect(rejected!.reason).toBeInstanceOf(CrossDispatchCycleError);
  });

  it("detects reentrant Saga self-deadlock cycles across EventBus and CommandBus", async () => {
    const executionContext = new NodeExecutionContext();
    const eventBus = new InMemoryEventBus(new InMemoryEventStore(), {}, undefined, undefined, executionContext);
    const commandBus = new InMemoryCommandBus({ executionContext, eventBus });
    commandBus.setConfig({ autoPublishEvents: true });

    class EmitFollowUpCommandHandler extends AbstractCommandHandler<TestCommand, void> {
      async execute(_command: TestCommand, context: CommandHandlerContext): Promise<void> {
        context.events.push(new TestDomainEvent("corr-saga", { id: "step-2" }, { id: "evt-step-2" }));
      }
    }

    class OrderSaga extends Saga<{ step: number }> {
      protected getInitialState() {
        return { step: 0 };
      }

      protected getSagaId(): string {
        return "saga-1";
      }

      protected configure(): void {
        this.on(TestDomainEvent.NAME, async (event: TestDomainEvent, ctx) => {
          if (event.getPayload().id === "step-1") {
            await ctx.dispatch(new TestCommand("corr-saga", { id: "trigger-2" }));
          }
        });
      }
    }

    commandBus.register(TestCommand.TYPE, new EmitFollowUpCommandHandler());
    const saga = new OrderSaga(commandBus, new InMemorySagaStateStore());
    eventBus.subscribe(TestDomainEvent.NAME, saga);

    await expect(
      eventBus.publish(new TestDomainEvent("corr-saga", { id: "step-1" }, { id: "evt-step-1" })),
    ).rejects.toThrow(CrossDispatchCycleError);
  });
});

describe("3. Cache isolation & domain class support", () => {
  it("clones domain classes on write and read and rejects unsupported values without replacing existing entries", async () => {
    const cache = new InMemoryCache<unknown>();

    const entity = new OrderEntity(new UUIDValue("123e4567-e89b-12d3-a456-426614174000"), 100, ["item-1"]);
    const money = new MoneyValue({ amount: 50, currency: "USD" });
    const okResult = Result.success({ entity, money });

    await cache.set("domain-key", okResult, 60_000, ["tag-a"]);

    // Mutate original objects after write
    entity.total = 999;
    entity.items.push("mutated-write");

    const read1 = (await cache.get("domain-key")) as Result<{ entity: OrderEntity; money: MoneyValue }, Error>;
    expect(read1.isSuccess()).toBe(true);
    const unwrapped1 = read1.value;
    expect(unwrapped1.entity).toBeInstanceOf(OrderEntity);
    expect(unwrapped1.entity.id).toBeInstanceOf(UUIDValue);
    expect(unwrapped1.entity.total).toBe(100);
    expect(unwrapped1.entity.items).toEqual(["item-1"]);
    expect(unwrapped1.money).toBeInstanceOf(MoneyValue);
    expect(unwrapped1.money.equals(new MoneyValue({ amount: 50, currency: "USD" }))).toBe(true);

    // Mutate value returned on read
    unwrapped1.entity.total = 555;
    unwrapped1.entity.items.push("mutated-read");

    const read2 = (await cache.get("domain-key")) as Result<{ entity: OrderEntity; money: MoneyValue }, Error>;
    expect(read2.value.entity.total).toBe(100);
    expect(read2.value.entity.items).toEqual(["item-1"]);

    // Unsupported value rejects without replacing or deleting existing entry (even with ttl = 0)
    await expect(cache.set("domain-key", { invalid: () => {} })).rejects.toThrow();
    await expect(cache.set("domain-key", { invalid: () => {} }, 0)).rejects.toThrow();

    const readAfterFailedOverwrite = (await cache.get("domain-key")) as Result<
      { entity: OrderEntity; money: MoneyValue },
      Error
    >;
    expect(readAfterFailedOverwrite.value.entity.total).toBe(100);

    // Custom copier is also supported
    const customCache = new InMemoryCache<{ fn: () => number }>({
      cloneValue: val => ({ fn: val.fn }),
    });
    await customCache.set("fn-key", { fn: () => 42 });
    const customRead = await customCache.get("fn-key");
    expect(customRead?.fn()).toBe(42);
  });

  it("isolates domain objects in InMemoryQueryBus and InMemoryIdempotencyStore", async () => {
    const executionContext = new NodeExecutionContext();
    const queryBus = new InMemoryQueryBus({ executionContext });
    queryBus.setConfig({ enableCaching: true, cacheTtl: 60_000 });

    class GetOrderQueryHandler extends AbstractQueryHandler<TestQuery, OrderEntity> {
      async execute(query: TestQuery, _context: QueryHandlerContext): Promise<OrderEntity> {
        return new OrderEntity(
          new UUIDValue("123e4567-e89b-12d3-a456-426614174000"),
          250,
          [query.getPayload().id],
        );
      }
    }

    queryBus.register(TestQuery.TYPE, new GetOrderQueryHandler(), {
      getKey: q => q.getPayload().id,
    });

    const first = await queryBus.dispatch<TestQuery, OrderEntity>(new TestQuery("q-1", { id: "ord-1" }));
    expect(first).toBeInstanceOf(OrderEntity);
    first.total = 0;
    first.items.push("tampered");

    const second = await queryBus.dispatch<TestQuery, OrderEntity>(new TestQuery("q-2", { id: "ord-1" }));
    expect(second).toBeInstanceOf(OrderEntity);
    expect(second.total).toBe(250);
    expect(second.items).toEqual(["ord-1"]);

    const idempotencyStore = new InMemoryIdempotencyStore();
    const firstIdemp = await idempotencyStore.execute("k-1", async () => ({ list: ["a"] }));
    firstIdemp.list.push("tampered");
    const secondIdemp = await idempotencyStore.execute("k-1", async () => ({ list: ["b"] }));
    expect(secondIdemp).toEqual({ list: ["a"] });
  });
});

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

describe("5. fromPrimitives and toPrimitives across Domain Building Blocks", () => {
  it("hydrates Command, Query, and DomainEvent via static fromPrimitives and registries", () => {
    const cmd = new TestCommand("corr-cmd", { id: "c-1", value: "v-1" }, { tenantId: "tenant-a" });
    const cmdPrimitives = cmd.toPrimitives();
    const hydratedCmd = TestCommand.fromPrimitives(cmdPrimitives);

    expect(hydratedCmd).toBeInstanceOf(TestCommand);
    expect(hydratedCmd.getMetadata().id).toBe(cmd.getMetadata().id);
    expect(hydratedCmd.getMetadata().correlationId).toBe("corr-cmd");
    expect(hydratedCmd.getMetadata().tenantId).toBe("tenant-a");
    expect(hydratedCmd.getPayload()).toEqual({ id: "c-1", value: "v-1" });

    CommandRegistry.register(TestCommand.TYPE, TestCommand);
    const registryCmd = CommandRegistry.fromPrimitives<TestCommand>(cmdPrimitives);
    expect(registryCmd).toBeInstanceOf(TestCommand);
    expect(registryCmd.toPrimitives()).toEqual(cmdPrimitives);

    const qry = new TestQuery("corr-qry", { id: "q-1" }, { tenantId: "tenant-b" });
    const qryPrimitives = qry.toPrimitives();
    const hydratedQry = TestQuery.fromPrimitives(qryPrimitives);

    expect(hydratedQry).toBeInstanceOf(TestQuery);
    expect(hydratedQry.getMetadata().id).toBe(qry.getMetadata().id);
    expect(hydratedQry.getMetadata().correlationId).toBe("corr-qry");
    expect(hydratedQry.getMetadata().tenantId).toBe("tenant-b");
    expect(hydratedQry.getPayload()).toEqual({ id: "q-1" });

    QueryRegistry.register(TestQuery.TYPE, TestQuery);
    const registryQry = QueryRegistry.fromPrimitives<TestQuery>(qryPrimitives);
    expect(registryQry).toBeInstanceOf(TestQuery);
    expect(registryQry.toPrimitives()).toEqual(qryPrimitives);

    const evt = new TestDomainEvent("corr-evt", { id: "e-1" }, { tenantId: "tenant-c", version: 3 });
    const evtPrimitives = evt.toPrimitives();
    const hydratedEvt = TestDomainEvent.fromPrimitives(evtPrimitives);

    expect(hydratedEvt).toBeInstanceOf(TestDomainEvent);
    expect(hydratedEvt.id).toBe(evt.id);
    expect(hydratedEvt.getMetadata().correlationId).toBe("corr-evt");
    expect(hydratedEvt.getMetadata().tenantId).toBe("tenant-c");
    expect(hydratedEvt.getMetadata().version).toBe(3);
    expect(hydratedEvt.getPayload()).toEqual({ id: "e-1" });

    DomainEventRegistry.register(TestDomainEvent.NAME, TestDomainEvent);
    const registryEvt = DomainEventRegistry.fromPrimitives<TestDomainEvent>(evtPrimitives);
    expect(registryEvt).toBeInstanceOf(TestDomainEvent);
    expect(registryEvt.toPrimitives()).toEqual(evtPrimitives);
  });

  it("supports Criteria, ValueObjects, EntityRegistry, and AggregateRoot fromPrimitives/toPrimitives", () => {
    const criteria = Criteria.none()
      .where("status", "=", "active")
      .orderBy("createdAt", "DESC")
      .limitResults(25)
      .offsetResults(2);

    const criteriaPrimitives = criteria.toPrimitives();
    const hydratedCriteria = Criteria.fromPrimitives(criteriaPrimitives);
    expect(hydratedCriteria.toPrimitives()).toEqual(criteriaPrimitives);

    const uuid = UUIDValue.fromPrimitives("123e4567-e89b-12d3-a456-426614174000");
    expect(uuid.toPrimitives()).toBe("123e4567-e89b-12d3-a456-426614174000");

    const email = EmailValue.fromPrimitives("user@example.com");
    expect(email.toPrimitives()).toBe("user@example.com");

    const slug = SlugValue.fromPrimitives("hello-world");
    expect(slug.toPrimitives()).toBe("hello-world");

    const coords = CoordinatesValue.fromPrimitives({ latitude: 40.7128, longitude: -74.006 });
    expect(coords.toPrimitives()).toEqual({ latitude: 40.7128, longitude: -74.006 });

    const dateVal = DateValue.fromPrimitives("2026-01-01T00:00:00.000Z");
    expect(dateVal.toPrimitives()).toBe("2026-01-01T00:00:00.000Z");

    const urlVal = URLValue.fromPrimitives("https://example.com/test");
    expect(urlVal.toPrimitives()).toBe("https://example.com/test");

    class InvoiceAggregate extends AggregateRoot<UUIDValue> {
      public amount: number;

      constructor(id: UUIDValue, amount = 0) {
        super(id);
        this.amount = amount;
      }

      protected createId(rawId: string | UUIDValue): UUIDValue {
        return rawId instanceof UUIDValue ? rawId : UUIDValue.fromPrimitives(rawId);
      }

      toPrimitives(): Record<string, unknown> {
        return { id: this.id.toPrimitives(), amount: this.amount };
      }

      restoreFromPrimitives(primitives: Record<string, any>): void {
        this.amount = Number(primitives.amount);
      }
    }

    const hydratedAggregate = InvoiceAggregate.fromPrimitives({
      id: "123e4567-e89b-12d3-a456-426614174000",
      amount: 450,
    });

    expect(hydratedAggregate).toBeInstanceOf(InvoiceAggregate);
    expect(hydratedAggregate.id.toPrimitives()).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(hydratedAggregate.amount).toBe(450);

    EntityRegistry.register("InvoiceAggregate", InvoiceAggregate);
    const registryAggregate = EntityRegistry.fromPrimitives<InvoiceAggregate>("InvoiceAggregate", {
      id: "123e4567-e89b-12d3-a456-426614174000",
      amount: 900,
    });
    expect(registryAggregate).toBeInstanceOf(InvoiceAggregate);
    expect(registryAggregate.amount).toBe(900);
  });
});
