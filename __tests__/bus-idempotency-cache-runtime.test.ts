import {
  AbstractCommand,
  AbstractCommandHandler,
  AbstractQuery,
  AbstractQueryHandler,
  AggregateRoot,
  ArrayValue,
  AsyncUnitOfWorkRunner,
  BaseValueObject,
  BooleanValue,
  CommandNotRegistered,
  CommandRegistry,
  CommitOutcomeUnknownError,
  ConsoleLogger,
  CoordinatesValue,
  Criteria,
  CrossDispatchCycleError,
  DateValue,
  debounce,
  DomainEvent,
  DomainEventRegistry,
  EmailValue,
  Entity,
  EntityJSONAPIMapper,
  EntityNotRegistered,
  EntityRegistry,
  EnumValue,
  ErrorTracker,
  ErrorTrackingMiddleware,
  FetchHTTPProvider,
  FloatValue,
  HTMLValue,
  HTTPException,
  InMemoryAuthProvider,
  InMemoryCache,
  InMemoryCommandBus,
  InMemoryDAO,
  InMemoryDeadLetterStore,
  InMemoryErrorStore,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemoryFileProvider,
  InMemoryHTTPProvider,
  InMemoryIdempotencyStore,
  InMemoryIdentityProvider,
  InMemoryLogger,
  InMemoryMailer,
  InMemoryOfflineStore,
  InMemoryPubSub,
  InMemoryQueryBus,
  InMemorySagaStateStore,
  InMemoryStateManager,
  InMemoryTransactionalIdempotencyAdapter,
  InMemoryTranslationResolver,
  InMemoryUnitOfWork,
  InMemoryUnitOfWorkRunner,
  JSONAPIConnector,
  JSONAPIErrors,
  LimitNotValid,
  Logger,
  LoggingMailer,
  MarkdownValue,
  NotAuthenticated,
  NotAuthorized,
  ObjectValue,
  OfflineCommandSync,
  OffsetNotValid,
  PaginationLinksGenerator,
  PascalCamelToSnake,
  PathValue,
  PhoneValue,
  QueryRegistry,
  RemoteFileToBase64,
  Result,
  retry,
  Saga,
  SagaManager,
  SharedKernelTranslationKeys,
  slugify,
  SlugValue,
  SnakeToCamel,
  StaticRBACPolicy,
  StringValue,
  unorderedObjectArrayEqual,
  URLCriteriaBuilder,
  URLCriteriaParser,
  URLValue,
  URLWithParamsBuilder,
  UUIDValue,
  ValuesNotValid,
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
    expect(hydratedCmd.id).toBe(cmd.id);
    expect(hydratedCmd.correlationId).toBe("corr-cmd");
    expect(hydratedCmd.tenantId).toBe("tenant-a");
    expect(hydratedCmd.getPayload()).toEqual({ id: "c-1", value: "v-1" });

    CommandRegistry.register(TestCommand.TYPE, TestCommand);
    const registryCmd = CommandRegistry.fromPrimitives<TestCommand>(cmdPrimitives);
    expect(registryCmd).toBeInstanceOf(TestCommand);
    expect(registryCmd.toPrimitives()).toEqual(cmdPrimitives);

    const qry = new TestQuery("corr-qry", { id: "q-1" }, { tenantId: "tenant-b" });
    const qryPrimitives = qry.toPrimitives();
    const hydratedQry = TestQuery.fromPrimitives(qryPrimitives);

    expect(hydratedQry).toBeInstanceOf(TestQuery);
    expect(hydratedQry.id).toBe(qry.id);
    expect(hydratedQry.correlationId).toBe("corr-qry");
    expect(hydratedQry.tenantId).toBe("tenant-b");
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
    expect(hydratedEvt.correlationId).toBe("corr-evt");
    expect(hydratedEvt.tenantId).toBe("tenant-c");
    expect(hydratedEvt.version).toBe(3);
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

        this.on<TestDomainEvent>(TestDomainEvent.NAME, async (event, ctx) => {
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

    const nycId = new UUIDValue("123e4567-e89b-12d3-a456-426614174001");
    const laId = new UUIDValue("123e4567-e89b-12d3-a456-426614174002");

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

describe("7. Transactional Outbox on UnitOfWork and Async Combinators / Serialization on Result", () => {
  it("stages domain events into EventStore on commit, publishes post-commit, and discards on rollback", async () => {
    const executionContext = new NodeExecutionContext();
    const eventStore = new InMemoryEventStore();
    const eventBus = new InMemoryEventBus(
      eventStore,
      undefined,
      undefined,
      undefined,
      executionContext,
    );
    DomainEventRegistry.register(TestDomainEvent.NAME, TestDomainEvent);

    const publishedIds: string[] = [];
    let failSubscriberOnce = false;

    eventBus.subscribe(TestDomainEvent.NAME, {
      getName: () => "outbox-sub",
      getOptions: () => ({ retryOnError: false }),
      handle: async event => {
        if (failSubscriberOnce) {
          failSubscriberOnce = false;
          throw new Error("subscriber transient error");
        }
        publishedIds.push(event.id);
      },
    });

    class AccountAggregate extends AggregateRoot<UUIDValue> {
      constructor(id: UUIDValue, public balance: number) {
        super(id);
      }

      credit(amount: number, eventId: string): void {
        this.balance += amount;
        this.recordDomainEvent(
          new TestDomainEvent("corr-outbox", { id: this.id.value }, { id: eventId }),
        );
      }

      toPrimitives(): Record<string, any> {
        return { id: this.id.value, balance: this.balance };
      }
    }

    const runner = new InMemoryUnitOfWorkRunner({
      eventStore,
      eventBus,
    });

    const accountId = new UUIDValue("123e4567-e89b-12d3-a456-426614174010");
    const account = new AccountAggregate(accountId, 100);

    // 1. Rollback discards staged events without writing to EventStore or publishing to EventBus
    await expect(
      runner.run(async uow => {
        uow.collectEventsFrom?.(account);
        account.credit(50, "evt-rolled-back");
        throw new Error("abort transaction");
      }),
    ).rejects.toThrow("abort transaction");

    expect(await eventStore.all()).toEqual([]);
    expect(publishedIds).toEqual([]);

    // 2. Commit stages events into EventStore, marks aggregate committed, runs postCommit hooks, and publishes to EventBus
    const postCommitEventIds: string[] = [];
    await runner.run(async uow => {
      uow.collectEventsFrom?.(account);
      account.credit(75, "evt-committed-1");
      uow.onPostCommit?.(events => {
        postCommitEventIds.push(...events.map(e => e.id));
      });
    });

    expect(account.hasUncommittedChanges).toBe(false);
    expect(postCommitEventIds).toEqual(["evt-committed-1"]);
    expect(publishedIds).toEqual(["evt-committed-1"]);
    expect(await eventStore.isProcessed("evt-committed-1")).toBe(true);

    // 3. If subscriber fails during post-commit publish, event remains safely in EventStore outbox and is delivered on replay()
    failSubscriberOnce = true;
    await runner.run(async uow => {
      uow.collectEventsFrom?.(account);
      account.credit(25, "evt-committed-2");
    });

    expect((await eventStore.all()).map(e => e.id)).toEqual(["evt-committed-2"]);
    await eventBus.replay();
    expect(publishedIds).toEqual(["evt-committed-1", "evt-committed-2"]);
    expect(await eventStore.all()).toEqual([]);

    await eventBus.close();
  });

  it("supports Result.fromPromise, mapAsync, flatMapAsync, mapErrorAsync, matchAsync, and toPrimitives/fromPrimitives", async () => {
    const okFromPromise = await Result.fromPromise(async () => 21);
    const mapped = await okFromPromise
      .mapAsync(async x => x * 2)
      .then(r => r.flatMapAsync(async x => Result.success(`val:${x}`)));

    expect(mapped.isSuccess()).toBe(true);
    expect(mapped.value).toBe("val:42");

    const matchedOk = await mapped.matchAsync(
      async v => `ok(${v})`,
      async err => `err(${err.message})`,
    );
    expect(matchedOk).toBe("ok(val:42)");

    const okPrimitives = mapped.toPrimitives();
    expect(okPrimitives).toEqual({ isSuccess: true, value: "val:42" });
    const restoredOk = Result.fromPrimitives<string>(okPrimitives);
    expect(restoredOk.isSuccess()).toBe(true);
    expect(restoredOk.value).toBe("val:42");

    const failFromPromise = await Result.fromPromise(async () => {
      throw new Error("boom");
    });
    const mappedErr = await failFromPromise.mapErrorAsync(async err => {
      const custom = new Error(`wrapped:${err.message}`);
      custom.name = "CustomDomainError";
      return custom;
    });

    expect(mappedErr.isFailure()).toBe(true);
    const errPrimitives = mappedErr.toPrimitives();
    expect(errPrimitives).toEqual({
      isSuccess: false,
      error: { name: "CustomDomainError", message: "wrapped:boom" },
    });

    const restoredErr = Result.fromPrimitives<never, Error>(errPrimitives);
    expect(restoredErr.isFailure()).toBe(true);
    expect(restoredErr.error).toBeInstanceOf(Error);
    expect(restoredErr.error.name).toBe("CustomDomainError");
    expect(restoredErr.error.message).toBe("wrapped:boom");
  });

  it("routes InMemoryPubSub and LoggingMailer logs through Logger contract and normalizes Float/HTML/Markdown value objects", async () => {
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

    const mailer = new LoggingMailer(logger);
    await mailer.send({
      from: "noreply@example.com",
      to: ["customer@example.com"],
      subject: "Order Confirmation",
      body: "Thanks!",
    });
    expect(loggedInfos).toHaveLength(1);
    expect(loggedInfos[0]?.message).toContain("Order Confirmation");

    class PriceFloat extends FloatValue {
      readonly attributeName = "price";
    }
    class SnippetHTML extends HTMLValue {
      readonly attributeName = "snippet";
    }
    class ReadmeMarkdown extends MarkdownValue {
      readonly attributeName = "readme";
    }

    const price = PriceFloat.fromPrimitives(19.995, 2);
    expect(price.toPrimitives()).toBe(20);
    expect(price.isValid).toBe(true);

    const html = SnippetHTML.fromPrimitives("<p>Hello</p>");
    expect(html.toPrimitives()).toBe("<p>Hello</p>");
    expect(html.isValid).toBe(true);

    const md = ReadmeMarkdown.fromPrimitives("# Title");
    expect(md.toPrimitives()).toBe("# Title");
    expect(md.isValid).toBe(true);
  });
});

describe("8. JSON:API, HTTP, RBAC/ABAC, StateManager, Offline, and ErrorTracking", () => {
  it("fixes URLCriteriaParser numeric/boolean/date/array_contains_any parsing, offsetResults(0), PaginationLinksGenerator, and JSONAPIConnector relative URLs", async () => {
    const baseUrl = new URL("https://api.example.com/orders?filter[tenant]=acme");
    const built = new URLCriteriaBuilder(
      baseUrl,
      Criteria.none()
        .where("amount", "GREATER_THAN", 42)
        .where("active", "EQUAL", true)
        .where("createdAt", "GREATER_THAN_OR_EQUAL", "2026-01-15T00:00:00.000Z")
        .where("tags", "ARRAY_CONTAINS_ANY", ["urgent", "vip"])
        .limitResults(10)
        .offsetResults(0),
    ).build();

    const parsed = new URLCriteriaParser(built).parse();
    expect(parsed.limit).toBe(10);
    expect(parsed.offset).toBe(0);

    const amountFilter = parsed.filters.find(f => f.field === "amount");
    expect(amountFilter?.value).toBe(42);
    expect(typeof amountFilter?.value).toBe("number");

    const activeFilter = parsed.filters.find(f => f.field === "active");
    expect(activeFilter?.value).toBe(true);

    const dateFilter = parsed.filters.find(f => f.field === "createdAt");
    expect(dateFilter?.value).toBeInstanceOf(Date);

    const tagsFilter = parsed.filters.find(f => f.field === "tags");
    expect(tagsFilter?.operator).toBe("ARRAY_CONTAINS_ANY");
    expect(tagsFilter?.value).toEqual(["urgent", "vip"]);

    // PaginationLinksGenerator preserves existing query params without duplicate '?'
    const links = new PaginationLinksGenerator(
      new URL("https://api.example.com/orders?filter[status]=open"),
    ).generate(0, 10, 25);

    expect(links.self).toBe("https://api.example.com/orders?filter[status]=open&page[offset]=0&page[limit]=10");
    expect(links.next).toBe("https://api.example.com/orders?filter[status]=open&page[offset]=10&page[limit]=10");
    expect(links.prev).toBeNull();

    // JSONAPIConnector handles relative URLs cleanly
    const requestedUrls: Array<string | URL> = [];
    const connector = new JSONAPIConnector({
      get: async url => {
        requestedUrls.push(url);
        return { data: [] } as any;
      },
      post: async () => ({ data: {} }) as any,
      put: async () => ({ data: {} }) as any,
      patch: async () => ({ data: {} }) as any,
      delete: async () => undefined as any,
    });

    await connector.findMany("/orders", {
      criteria: Criteria.none().where("page", "EQUAL", 1).limitResults(5).offsetResults(0),
      include: ["customer"],
    });
    expect(requestedUrls[0]).toBe("/orders?include=customer&filter%5Bpage%5D=1&page%5Blimit%5D=5&page%5Boffset%5D=0");
  });

  it("supports contextual and async ABAC predicates in RBACPolicy, StateManager isolation, OfflineCommandSync, and InMemoryErrorStore", async () => {
    const policy = new StaticRBACPolicy({
      editor: [{ resource: "document", action: "update" }],
    });

    const user = { id: "u-1" };
    const doc = { name: "document", ownerId: "u-1", locked: false };

    const syncAllowed = policy.canWithAttributes(
      user,
      "editor",
      "update",
      doc,
      [(u, r, ctx?: { bypassLock: boolean }) => u.id === r.ownerId && (!r.locked || Boolean(ctx?.bypassLock))],
      { bypassLock: true },
    );
    expect(syncAllowed).toBe(true);

    const asyncAllowed = await policy.canWithAttributesAsync(
      user,
      ["editor"],
      "update",
      { ...doc, locked: true },
      [async (u, r, ctx?: { bypassLock: boolean }) => u.id === r.ownerId && Boolean(ctx?.bypassLock)],
      { bypassLock: true },
    );
    expect(asyncAllowed).toBe(true);

    // StateManager isolation
    const stateManager = new InMemoryStateManager({
      profile: { name: "Alice", roles: ["admin"] },
    });
    const readProfile = stateManager.getValue("profile");
    readProfile.name = "Tampered";
    readProfile.roles.push("hacker");
    expect(stateManager.getValue("profile")).toEqual({ name: "Alice", roles: ["admin"] });

    stateManager.setValue("profile", { name: "Bob", roles: ["user"] });
    stateManager.reset();
    expect(stateManager.getState().profile).toEqual({ name: "Alice", roles: ["admin"] });

    // OfflineStore & OfflineCommandSync
    const executionContext = new NodeExecutionContext();
    const commandBus = new InMemoryCommandBus({ executionContext });
    const executedOfflineIds: string[] = [];

    class OfflineHandler extends AbstractCommandHandler<TestCommand, void> {
      async execute(command: TestCommand): Promise<void> {
        executedOfflineIds.push(command.getPayload().id);
      }
    }
    commandBus.register(TestCommand.TYPE, new OfflineHandler());
    CommandRegistry.register(TestCommand.TYPE, TestCommand);

    const offlineStore = new InMemoryOfflineStore();
    const offlineSync = new OfflineCommandSync(offlineStore, commandBus);

    await offlineSync.enqueueCommand(new TestCommand("corr-off", { id: "off-1" }));
    await offlineSync.enqueueCommand(new TestCommand("corr-off", { id: "off-2" }));
    expect(offlineStore.size()).toBe(2);

    const syncResult = await offlineSync.sync();
    expect(syncResult).toEqual({ processed: 2, failed: 0 });
    expect(executedOfflineIds).toEqual(["off-1", "off-2"]);
    expect(offlineStore.size()).toBe(0);

    // InMemoryErrorStore & ErrorTracker
    const errorStore = new InMemoryErrorStore({ maxErrors: 2 });
    const uploadedBatches: number[] = [];
    const tracker = new ErrorTracker(errorStore, {
      upload: async errors => {
        uploadedBatches.push(errors.length);
      },
    });

    await tracker.track(new Error("err-1"), { step: 1 });
    await tracker.track(new Error("err-2"), { step: 2 });
    await tracker.track(new Error("err-3"), { step: 3 });

    const storedErrors = await errorStore.all();
    expect(storedErrors).toHaveLength(2);
    await tracker.sync();
    expect(uploadedBatches).toEqual([2]);
    expect(await errorStore.all()).toEqual([]);
  });
});

describe("9. Formatters, i18n, RemoteFileToBase64, EntityJSONAPIMapper, and InMemoryFileProvider", () => {
  it("preserves Dates in formatters, replaces all i18n placeholders, converts Blobs in Node.js, and maps JSON:API entities bidirectionally", async () => {
    const timestamp = new Date("2026-05-01T12:00:00.000Z");
    const snakeFormatted = PascalCamelToSnake.formatObject({
      userId: "u-1",
      createdAt: timestamp,
      nestedProfile: { firstName: "Ada" },
    });
    expect(snakeFormatted).toEqual({
      user_id: "u-1",
      created_at: timestamp,
      nested_profile: { first_name: "Ada" },
    });
    expect((snakeFormatted as any).created_at).toBeInstanceOf(Date);

    const camelFormatted = SnakeToCamel.formatObject(snakeFormatted);
    expect(camelFormatted).toEqual({
      userId: "u-1",
      createdAt: timestamp,
      nestedProfile: { firstName: "Ada" },
    });
    expect(camelFormatted.createdAt).toBeInstanceOf(Date);

    // i18n repeated placeholder replacement
    const resolver = new InMemoryTranslationResolver({
      greeting: "Hello {name}, welcome back {name}!",
    });
    expect(resolver.resolve("greeting", { name: "Grace" })).toBe(
      "Hello Grace, welcome back Grace!",
    );

    // RemoteFileToBase64 in Node.js (without FileReader)
    const converter = new RemoteFileToBase64({
      get: async () => new Blob(["hello world"], { type: "text/plain" }) as any,
      post: async () => undefined as any,
      put: async () => undefined as any,
      patch: async () => undefined as any,
      delete: async () => undefined as any,
    });

    const converted = await converter.convert(new URL("https://cdn.example.com/hello.txt"), {
      cache: true,
      expectedMimeTypes: ["text/*"],
    });
    expect(converted.mimeType).toBe("text/plain");
    expect(converted.base64).toBe(
      `data:text/plain;base64,${Buffer.from("hello world").toString("base64")}`,
    );
    expect(converted.cached).toBe(false);

    const cachedConverted = await converter.convert(new URL("https://cdn.example.com/hello.txt"), {
      cache: true,
    });
    expect(cachedConverted.cached).toBe(true);

    // Bidirectional EntityJSONAPIMapper without mutating toPrimitives()
    const internalModel = {
      id: "123e4567-e89b-12d3-a456-426614174099",
      total: 320,
      items: ["book", "pen"],
    };

    class MappedOrderEntity extends Entity<UUIDValue, typeof internalModel> {
      constructor(
        id: UUIDValue,
        public total: number,
        public items: string[],
      ) {
        super(id);
      }

      protected createId(rawId: string): UUIDValue {
        return UUIDValue.fromPrimitives(rawId);
      }

      toPrimitives() {
        return internalModel;
      }

      restoreFromPrimitives(data: typeof internalModel): void {
        this.total = data.total;
        this.items = [...data.items];
      }
    }

    const mapper = new EntityJSONAPIMapper<typeof internalModel, MappedOrderEntity>(
      "orders",
      MappedOrderEntity,
    );
    const entity = new MappedOrderEntity(
      new UUIDValue(internalModel.id),
      internalModel.total,
      internalModel.items,
    );

    const jsonApiDoc = mapper.mapEntity(entity);
    expect(internalModel.id).toBe("123e4567-e89b-12d3-a456-426614174099");
    expect(jsonApiDoc).toEqual({
      data: {
        type: "orders",
        id: "123e4567-e89b-12d3-a456-426614174099",
        attributes: {
          total: 320,
          items: ["book", "pen"],
        },
      },
    });

    const roundTripEntity = mapper.toEntity(jsonApiDoc);
    expect(roundTripEntity).toBeInstanceOf(MappedOrderEntity);
    expect(roundTripEntity.id.value).toBe("123e4567-e89b-12d3-a456-426614174099");
    expect(roundTripEntity.total).toBe(320);
    expect(roundTripEntity.items).toEqual(["book", "pen"]);

    // InMemoryFileProvider
    const fileProvider = new InMemoryFileProvider({ baseUrl: "https://cdn.example.com" });
    const uploadedKey = await fileProvider.upload(
      Buffer.from("file-contents"),
      "/invoices/2026/",
      "inv-001.txt",
      { contentType: "text/plain" },
    );
    expect(uploadedKey).toBe("invoices/2026/inv-001.txt");
    expect(await fileProvider.exists("invoices/2026", "inv-001.txt")).toBe(true);
    expect((await fileProvider.get("invoices/2026/inv-001.txt")).toString("utf8")).toBe(
      "file-contents",
    );
    expect(await fileProvider.list("invoices/")).toEqual(["invoices/2026/inv-001.txt"]);
    expect(fileProvider.getPublicURL("invoices/2026", "inv-001.txt")).toBe(
      "https://cdn.example.com/invoices/2026/inv-001.txt",
    );
    await fileProvider.delete("invoices/2026", "inv-001.txt");
    expect(await fileProvider.exists("invoices/2026", "inv-001.txt")).toBe(false);
  });
});

describe("10. Schema Validation, Array Utilities, ErrorTrackingMiddleware on EventBus, SagaManager, and Retry", () => {
  it("handles { required: false } and key-order-independent equals in ObjectValue/ArrayValue, and multiplicity in unorderedObjectArrayEqual", () => {
    interface ConfigPayload {
      host: string;
      port?: number | undefined;
    }

    class ConfigObjectValue extends ObjectValue<ConfigPayload> {
      readonly attributeName = "config";
      constructor(value: ConfigPayload) {
        super(value, {
          host: [{ required: true }, { type: "string" }],
          port: [{ required: false }, { type: "number" }],
        });
      }
    }

    const cfgWithoutOptional = new ConfigObjectValue({ host: "localhost" });
    expect(cfgWithoutOptional.isValid).toBe(true);

    const cfgKeyOrder1 = new ConfigObjectValue({ host: "localhost", port: 8080 });
    const cfgKeyOrder2 = new ConfigObjectValue({ port: 8080, host: "localhost" });
    expect(cfgKeyOrder1.equals(cfgKeyOrder2)).toBe(true);

    class TagsArrayValue extends ArrayValue<{ a: number; b: number }> {
      readonly attributeName = "tags";
      readonly isPrimitive = false;
      constructor(value: Array<{ a: number; b: number }>) {
        super(value, {
          a: [{ required: true }, { type: "number" }],
          b: [{ required: true }, { type: "number" }],
        });
      }
    }

    const arr1 = new TagsArrayValue([{ a: 1, b: 2 }]);
    const arr2 = new TagsArrayValue([{ b: 2, a: 1 }]);
    expect(arr1.equals(arr2)).toBe(true);

    // unorderedObjectArrayEqual checks duplicate counts and nested keys
    expect(
      unorderedObjectArrayEqual(
        [{ id: 1 }, { id: 1 }, { id: 2 }],
        [{ id: 1 }, { id: 2 }, { id: 2 }],
      ),
    ).toBe(false);

    expect(
      unorderedObjectArrayEqual(
        [{ meta: { x: 1, y: 2 } }, { meta: { a: 3, b: 4 } }],
        [{ meta: { b: 4, a: 3 } }, { meta: { y: 2, x: 1 } }],
      ),
    ).toBe(true);
  });

  it("tracks EventBus errors in ErrorTrackingMiddleware, supports SagaManager.unregister, and supports retry options", async () => {
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

    // SagaManager register / unregister
    const commandBus = new InMemoryCommandBus({ executionContext });
    const stateStore = new InMemorySagaStateStore();
    let sagaCalls = 0;

    class UnregisterableSaga extends Saga {
      protected getInitialState() {
        return {};
      }
      protected getSagaId(event: DomainEvent): string {
        return event.id;
      }
      protected configure(): void {
        this.on(SecondaryCommand.TYPE, async () => {
          sagaCalls++;
        });
      }
    }

    const sagaManager = new SagaManager(eventBus);
    const saga = new UnregisterableSaga(commandBus, stateStore);
    sagaManager.register(saga);
    expect(sagaManager.getRegisteredSagas()).toEqual([saga]);
    expect(sagaManager.unregister(saga)).toBe(true);
    expect(sagaManager.getRegisteredSagas()).toEqual([]);

    await eventBus.close();

    // retry with options & shouldRetry
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("transient");
        }
        return "recovered";
      },
      {
        retries: 3,
        delayMs: 5,
        backoffFactor: 2,
        maxDelayMs: 20,
        shouldRetry: err => err instanceof Error && err.message === "transient",
      },
    );
    expect(result).toBe("recovered");
    expect(attempts).toBe(3);
  });

  it("enforces PathValue traversal protection, DateValue invalid date check, PhoneValue anchor, EmailValue TLDs/+ tags, UUIDv7, and String/Coordinates/Boolean validation", () => {
    class UploadPath extends PathValue {
      readonly attributeName = "uploadPath";
    }
    expect(new UploadPath("/var/uploads/report.pdf", ["/var/uploads"]).isValid).toBe(true);
    expect(new UploadPath("/var/uploads/../../etc/passwd", ["/var/uploads"]).isValid).toBe(false);
    expect(new UploadPath("/var/uploads-other/file.txt", ["/var/uploads"]).isValid).toBe(false);
    expect(new UploadPath("/var/uploads/file\0.txt", ["/var/uploads"]).isValid).toBe(false);

    class CreatedDate extends DateValue {
      readonly attributeName = "createdAt";
    }
    expect(CreatedDate.fromPrimitives("not-a-valid-date").isValid).toBe(false);
    expect(CreatedDate.fromPrimitives("2026-10-28T00:00:00.000Z").isValid).toBe(true);

    class ContactPhone extends PhoneValue {
      readonly attributeName = "phone";
    }
    expect(new ContactPhone("+12345678901").isValid).toBe(true);
    expect(new ContactPhone("call me at +12345678901").isValid).toBe(false);

    class UserEmail extends EmailValue {
      readonly attributeName = "email";
    }
    expect(new UserEmail("dev+alerts@company.engineering").isValid).toBe(true);

    // UUIDv7 support and case-insensitive equality
    const uuidV7Lower = UUIDValue.fromPrimitives("018f3b24-a450-7b2c-9d1e-34567890abcd");
    const uuidV7Upper = UUIDValue.fromPrimitives("018F3B24-A450-7B2C-9D1E-34567890ABCD");
    expect(uuidV7Lower.isValid).toBe(true);
    expect(uuidV7Lower.equals(uuidV7Upper)).toBe(true);

    class EmptyOnlyString extends StringValue {
      readonly attributeName = "empty";
    }
    expect(new EmptyOnlyString("", 0, 0).isValid).toBe(true);
    expect(new EmptyOnlyString("a", 0, 0).isValid).toBe(false);

    expect(CoordinatesValue.fromPrimitives({ latitude: Number.NaN, longitude: 0 }).isValid).toBe(false);

    class FlagBoolean extends BooleanValue {
      readonly attributeName = "flag";
    }
    expect(new FlagBoolean(true).isValid).toBe(true);
    expect(new FlagBoolean("true" as unknown as boolean).isValid).toBe(false);
  });

  it("supports non-mutating URLWithParamsBuilder, circular-safe ConsoleLogger, InMemoryLogger, InMemoryAuthProvider, and InMemoryIdentityProvider", async () => {
    const originalUrl = new URL("https://api.example.com/items?tag=legacy&keep=1");
    const builtUrl = new URLWithParamsBuilder(originalUrl)
      .with({ tag: ["alpha", "beta"], keep: undefined, page: 2 })
      .build();

    expect(originalUrl.toString()).toBe("https://api.example.com/items?tag=legacy&keep=1");
    expect(builtUrl.searchParams.getAll("tag")).toEqual(["alpha", "beta"]);
    expect(builtUrl.searchParams.get("keep")).toBeNull();
    expect(builtUrl.searchParams.get("page")).toBe("2");

    // ConsoleLogger safe serialization for circular refs and BigInt
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

    // InMemoryLogger
    const memLogger = new InMemoryLogger("info");
    memLogger.debug("ignored debug");
    const mutableCtx = { requestId: "req-1" };
    memLogger.info("handled request", mutableCtx);
    mutableCtx.requestId = "mutated";

    expect(memLogger.getEntries()).toHaveLength(1);
    expect(memLogger.getByLevel("info")[0]?.context).toEqual({ requestId: "req-1" });
    memLogger.clear();
    expect(memLogger.getEntries()).toHaveLength(0);

    // InMemoryAuthProvider
    class AuthUserEntity extends Entity<UUIDValue, { id: string; name: string }> {
      constructor(id: UUIDValue, public name: string) {
        super(id);
      }
      protected createId(rawId: string): UUIDValue {
        return UUIDValue.fromPrimitives(rawId);
      }
      toPrimitives() {
        return { id: this.id.value, name: this.name };
      }
      restoreFromPrimitives(data: { id: string; name: string }): void {
        this.name = data.name;
      }
    }

    const authUser = new AuthUserEntity(
      new UUIDValue("123e4567-e89b-12d3-a456-426614174000"),
      "Ada",
    );
    const authProvider = new InMemoryAuthProvider({
      users: [
        {
          user: authUser,
          email: "ada@example.com",
          password: "secret",
          roles: ["admin"],
          permissions: [{ resource: "orders", action: "read" }],
        },
      ],
    });

    const authEvents: Array<string | null> = [];
    const unsubscribe = authProvider.onAuthChange(session => {
      authEvents.push(session ? String(session.user.id.value) : null);
    });

    const authResult = await authProvider.authenticate({
      email: "ada@example.com",
      password: "secret",
    });
    expect(authResult.token).toContain("access_");
    expect(await authProvider.isAuthenticated()).toBe(true);
    expect(await authProvider.getCurrentUserRoles()).toEqual(["admin"]);

    const refreshed = await authProvider.refreshToken(authResult.refreshToken);
    expect(refreshed.token).not.toBe(authResult.token);

    await authProvider.logout();
    expect(await authProvider.isAuthenticated()).toBe(false);
    unsubscribe();
    expect(authEvents).toEqual([
      "123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174000",
      null,
    ]);

    // InMemoryIdentityProvider
    const idp = new InMemoryIdentityProvider();
    const createdUser = await idp.createUser({
      email: "grace@example.com",
      displayName: "Grace Hopper",
      emailVerified: true,
    });
    await idp.setCustomClaims(createdUser.id, { tier: "enterprise" });

    const idpToken = idp.issueToken(createdUser.id, undefined, { scope: "full" });
    const verified = await idp.verifyToken(idpToken);
    expect(verified).toEqual({
      userId: createdUser.id,
      claims: { tier: "enterprise", scope: "full" },
    });

    await idp.deleteUser(createdUser.id);
    await expect(idp.verifyToken(idpToken)).rejects.toThrow();
  });

  it("aligns slugify with SlugValue, supports optional arrays/TypedArrays in ObjectValue, adds InMemoryMailer, and supports debounce.flush/pending", async () => {
    class ArticleSlug extends SlugValue {
      readonly attributeName = "slug";
    }

    const slugFromUnderscores = slugify("  Hello_World -- Café Crème!  ");
    expect(slugFromUnderscores).toBe("hello-world-cafe-creme");
    expect(new ArticleSlug(slugFromUnderscores).isValid).toBe(true);

    interface OptionalArrayPayload {
      title: string;
      tags?: string[];
      rawBytes?: Uint8Array;
    }

    class OptionalArrayObjectValue extends ObjectValue<OptionalArrayPayload> {
      readonly attributeName = "payload";
      constructor(value: OptionalArrayPayload) {
        super(value, {
          title: [{ required: true }, { type: "string" }],
          tags: { _: [{ required: false }, { type: "string" }] },
        });
      }
    }

    const voWithBytes = new OptionalArrayObjectValue({
      title: "Report",
      rawBytes: new Uint8Array([1, 2, 3]),
    });
    expect(voWithBytes.isValid).toBe(true);

    // InMemoryMailer
    const mailer = new InMemoryMailer();
    await mailer.send({
      to: [{ name: "Ada", email: "Ada@Example.com" }],
      cc: "team@example.com",
      subject: "Welcome!",
      text: "Hello Ada",
    });

    expect(mailer.getSentMails()).toHaveLength(1);
    expect(mailer.getSentTo("ada@example.com")).toHaveLength(1);
    expect(mailer.getSentTo("TEAM@example.com")).toHaveLength(1);
    expect(mailer.getSentTo("other@example.com")).toHaveLength(0);
    mailer.clear();
    expect(mailer.getSentMails()).toHaveLength(0);

    // debounce.flush() and debounce.pending()
    const calls: string[] = [];
    const debouncedFn = debounce((val: string) => {
      calls.push(val);
    }, 5000);

    expect(debouncedFn.pending()).toBe(false);
    debouncedFn("first");
    debouncedFn("second");
    expect(debouncedFn.pending()).toBe(true);
    expect(calls).toEqual([]);

    debouncedFn.flush();
    expect(debouncedFn.pending()).toBe(false);
    expect(calls).toEqual(["second"]);
  });

  it("enforces type-safe Entity/AggregateRoot equality, exact event sequence numbers, FloatValue Infinity/rounding fixes, ValuesNotValid message, and InMemoryPubSub isolation/wildcards", async () => {
    const sharedUuid = new UUIDValue("123e4567-e89b-12d3-a456-426614174000");

    class UserEntity extends Entity<UUIDValue, { id: string }> {
      toPrimitives() {
        return { id: this.id.value };
      }
    }
    class OrderEntity extends Entity<UUIDValue, { id: string }> {
      toPrimitives() {
        return { id: this.id.value };
      }
    }

    const userEnt = new UserEntity(sharedUuid);
    const userEnt2 = new UserEntity(sharedUuid);
    const orderEnt = new OrderEntity(sharedUuid);

    expect(userEnt.equals(userEnt2)).toBe(true);
    expect(userEnt.equals(orderEnt)).toBe(false);

    class OrderAggregate extends AggregateRoot<UUIDValue> {
      touchWithoutEvent(): void {
        this.incrementVersion();
      }
      emit(event: DomainEvent): void {
        this.recordDomainEvent(event);
      }
      toPrimitives() {
        return { id: this.id.value };
      }
    }
    class InvoiceAggregate extends AggregateRoot<UUIDValue> {
      toPrimitives() {
        return { id: this.id.value };
      }
    }

    const orderAgg = new OrderAggregate(sharedUuid, 0);
    const invoiceAgg = new InvoiceAggregate(sharedUuid, 0);

    expect(orderAgg.equals(null)).toBe(false);
    expect(orderAgg.equals(invoiceAgg)).toBe(false);
    expect(orderAgg.equals(new OrderAggregate(sharedUuid, 5))).toBe(true);

    orderAgg.emit(new TestDomainEvent("c-1", { id: "1" }, { id: "ev-1" })); // version 1, seq 1
    orderAgg.touchWithoutEvent(); // version 2
    orderAgg.emit(new TestDomainEvent("c-1", { id: "2" }, { id: "ev-2" })); // version 3, seq 3

    const pulled = orderAgg.pullDomainEvents();
    expect(pulled.map(e => e.sequenceNumber)).toEqual([1, 3]);

    orderAgg.emit(new TestDomainEvent("c-1", { id: "3" }, { id: "ev-3" })); // version 4
    expect(orderAgg.version).toBe(4);
    orderAgg.clearDomainEvents();
    expect(orderAgg.version).toBe(3);

    // FloatValue Infinity rejection and IEEE-754 rounding
    class PriceFloat extends FloatValue {
      readonly attributeName = "price";
    }
    expect(new PriceFloat(Number.POSITIVE_INFINITY).isValid).toBe(false);
    expect(new PriceFloat(Number.NEGATIVE_INFINITY).isValid).toBe(false);
    const roundedPrice = new PriceFloat(1.005, 2);
    expect(roundedPrice.value).toBe(1.01);
    expect(roundedPrice.toString()).toBe("1.01");
    expect(roundedPrice.toJSON()).toBe(1.01);

    // ValuesNotValid message and name
    const invalidErr = new ValuesNotValid([
      Object.assign(new Error("Must be valid email"), { attributeName: "email" }),
      Object.assign(new Error(""), { attributeName: "age" }),
    ]);
    expect(invalidErr.name).toBe("ValuesNotValid");
    expect(invalidErr.message).toBe("Invalid values: email (Must be valid email), age");

    // InMemoryPubSub payload isolation and wildcard subscriptions
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

  it("supports array/replacement query params, async getAuthorization, empty JSON bodies in FetchHTTPProvider, HTTPException message, and InMemoryHTTPProvider", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedAuth: string | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedAuth = new Headers(init?.headers).get("Authorization");
      return new Response("", {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const http = new FetchHTTPProvider({
        baseUrl: "https://api.example.com",
        getAuthorization: async () => "Bearer async-token-123",
      });

      const res = await http.post("/items?page=1", {
        query: { page: 2, tag: ["x", "y"] },
        body: { name: "Item" },
      });

      expect(res).toBeUndefined();
      expect(capturedUrl).toBe("https://api.example.com/items?page=2&tag=x&tag=y");
      expect(capturedAuth).toBe("Bearer async-token-123");
    } finally {
      globalThis.fetch = originalFetch;
    }

    const httpErr = new HTTPException(422, { error: "Unprocessable" });
    expect(httpErr.name).toBe("HTTPException");
    expect(httpErr.message).toBe("HTTP Error 422");

    // InMemoryHTTPProvider
    const memHttp = new InMemoryHTTPProvider({ baseUrl: "https://api.example.com" });
    memHttp.on("GET", "/orders", req => ({
      items: ["o-1"],
      filter: req.url.searchParams.getAll("status"),
    }));

    const ordersRes = await memHttp.get<{ items: string[]; filter: string[] }>("/orders", {
      query: { status: ["open", "pending"] },
    });
    expect(ordersRes).toEqual({ items: ["o-1"], filter: ["open", "pending"] });
    expect(memHttp.getRequests()).toHaveLength(1);
    expect(memHttp.getRequests()[0]?.url.href).toBe(
      "https://api.example.com/orders?status=open&status=pending",
    );

    await expect(memHttp.get("/missing")).rejects.toThrow("HTTP Error 404");
  });

  it("round-trips GEO_RADIUS and Date filters between URLCriteriaBuilder and URLCriteriaParser, validates Criteria constructor, and populates domain exception metadata", () => {
    const startDate = new Date("2026-01-15T10:30:00.000Z");
    const initialCriteria = Criteria.none()
      .where("createdAt", "GREATER_THAN_OR_EQUAL", startDate)
      .where("location", "GEO_RADIUS", { center: [40.7128, -74.006], radiusInM: 2500 });

    const builtUrl = new URLCriteriaBuilder(
      new URL("https://api.example.com/events"),
      initialCriteria,
    ).build();

    expect(builtUrl.searchParams.get("filter[createdAt][gte]")).toBe("2026-01-15T10:30:00.000Z");
    expect(builtUrl.searchParams.get("filter[location][geo_radius]")).toBe(
      "40.7128,-74.006,2500",
    );

    const parsedCriteria = new URLCriteriaParser(builtUrl, ["createdAt", "location"]).parse();
    expect(parsedCriteria.filters[0]?.value).toEqual(startDate);
    expect(parsedCriteria.filters[1]?.value).toEqual({
      center: [40.7128, -74.006],
      radiusInM: 2500,
      lat: 40.7128,
      lng: -74.006,
      radius: 2500,
    });

    const rebuiltUrl = new URLCriteriaBuilder(
      new URL("https://api.example.com/events"),
      parsedCriteria,
    ).build();
    expect(rebuiltUrl.toString()).toBe(builtUrl.toString());

    // Criteria constructor & fromPrimitives validation
    expect(() => new Criteria([], [], 0)).toThrow(LimitNotValid);
    expect(() => Criteria.fromPrimitives({ offset: -1 })).toThrow(OffsetNotValid);

    // Domain exception names & messages
    const jsonApiErr = new JSONAPIErrors([
      {
        status: "400",
        code: "INVALID_FIELD",
        title: "Invalid Attribute",
        detail: "Email is required",
      },
    ]);
    expect(jsonApiErr.name).toBe("JSONAPIErrors");
    expect(jsonApiErr.message).toBe("Invalid Attribute: Email is required");

    const notAuthz = new NotAuthorized();
    expect(notAuthz.name).toBe("NotAuthorized");
    expect(notAuthz.message).toBe("Not Authorized");

    const notAuthen = new NotAuthenticated();
    expect(notAuthen.name).toBe("NotAuthenticated");
    expect(notAuthen.message).toBe("Not Authenticated");
  });

  it("supports registry has/unregister/clear, i18n param forwarding on *NotRegistered exceptions, and hash-preserving PaginationLinksGenerator", () => {
    CommandRegistry.register("temp.cmd", p => TestCommand.fromPrimitives(p));
    expect(CommandRegistry.has("temp.cmd")).toBe(true);
    expect(CommandRegistry.unregister("temp.cmd")).toBe(true);
    expect(CommandRegistry.has("temp.cmd")).toBe(false);

    QueryRegistry.register("temp.qry", p => TestQuery.fromPrimitives(p));
    expect(QueryRegistry.has("temp.qry")).toBe(true);
    QueryRegistry.clear();
    expect(QueryRegistry.has("temp.qry")).toBe(false);
    QueryRegistry.register(TestQuery.TYPE, TestQuery);

    EntityRegistry.register("temp.entity", () => ({}) as any);
    expect(EntityRegistry.has("temp.entity")).toBe(true);
    expect(EntityRegistry.unregister("temp.entity")).toBe(true);
    expect(EntityRegistry.has("temp.entity")).toBe(false);

    class MinimalRegisteredEvent extends DomainEvent<{ ok: boolean }> {
      getEventName(): string {
        return "temp.event";
      }
      getPayload() {
        return this.payload;
      }
    }
    DomainEventRegistry.register("temp.event", MinimalRegisteredEvent);
    expect(DomainEventRegistry.has("temp.event")).toBe(true);
    const hydratedMinimal = DomainEventRegistry.fromPrimitives({
      id: "ev-min-1",
      type: "temp.event",
      correlation_id: "corr-min",
      occurred_at: "2026-01-01T00:00:00.000Z",
      payload: { ok: true },
    } as any);
    expect(hydratedMinimal.getPayload()).toEqual({ ok: true });
    DomainEventRegistry.unregister("temp.event");
    expect(DomainEventRegistry.has("temp.event")).toBe(false);

    // i18n interpolation on EntityNotRegistered & CommandNotRegistered
    const i18n = new InMemoryTranslationResolver({
      [SharedKernelTranslationKeys.entities.errors.EntityNotRegistered]:
        "Missing entity: {entityName}",
      [SharedKernelTranslationKeys.cqrs.errors.CommandNotRegistered]:
        "Missing command: {command}",
    });

    const entityErr = new EntityNotRegistered("Invoice", i18n);
    expect(entityErr.name).toBe("EntityNotRegistered");
    expect(entityErr.message).toBe("Missing entity: Invoice");

    const cmdErr = new CommandNotRegistered("CreateInvoice", i18n);
    expect(cmdErr.name).toBe("CommandNotRegistered");
    expect(cmdErr.message).toBe("Missing command: CreateInvoice");

    // PaginationLinksGenerator with hash fragment and safe integer check
    const linksGen = new PaginationLinksGenerator(
      new URL("https://api.example.com/orders#results"),
    );
    const links = linksGen.generate(0, 10, 25);
    expect(links.self).toBe("https://api.example.com/orders?page[offset]=0&page[limit]=10#results");
    expect(links.next).toBe("https://api.example.com/orders?page[offset]=10&page[limit]=10#results");
    expect(() => linksGen.generate(1.5, 10, 25)).toThrow(OffsetNotValid);
  });

  it("dispatches unregistered Command/Query/DomainEvent via constructor fromPrimitives, isolates concurrent EventBus subscribers, and supports EventBus/DeadLetterStore helpers", async () => {
    const executionContext = new NodeExecutionContext();

    class LocalUnregisteredCommand extends AbstractCommand<{ amount: number }> {
      static readonly TYPE = "local.unregistered.command";
      getType(): string {
        return LocalUnregisteredCommand.TYPE;
      }
    }

    class LocalUnregisteredQuery extends AbstractQuery<{ id: string }> {
      static readonly TYPE = "local.unregistered.query";
      getType(): string {
        return LocalUnregisteredQuery.TYPE;
      }
    }

    class LocalUnregisteredEvent extends DomainEvent<{ items: string[] }> {
      static readonly NAME = "local.unregistered.event";
      getEventName(): string {
        return LocalUnregisteredEvent.NAME;
      }
    }

    const commandBus = new InMemoryCommandBus({ executionContext });
    commandBus.register<LocalUnregisteredCommand, number>(LocalUnregisteredCommand.TYPE, {
      handle: async cmd => cmd.getPayload().amount * 2,
    });
    expect(
      await commandBus.dispatch(new LocalUnregisteredCommand("corr-local", { amount: 21 })),
    ).toBe(42);

    const queryBus = new InMemoryQueryBus({ executionContext });
    queryBus.register<LocalUnregisteredQuery, string>(LocalUnregisteredQuery.TYPE, {
      handle: async qry => `found:${qry.getPayload().id}`,
    });
    expect(
      await queryBus.dispatch(new LocalUnregisteredQuery("corr-local", { id: "item-7" })),
    ).toBe("found:item-7");

    // InMemoryEventBus subscriber isolation, retry without global registration, and lifecycle helpers
    const deadLetterStore = new InMemoryDeadLetterStore();
    const eventBus = new InMemoryEventBus(
      new InMemoryEventStore(),
      { maxRetries: 1 },
      deadLetterStore,
      undefined,
      executionContext,
    );

    const observedItemsBySub2: string[][] = [];
    let sub1Attempts = 0;

    eventBus.subscribe<LocalUnregisteredEvent>(LocalUnregisteredEvent.NAME, {
      getName: () => "sub-1-mutating-and-retrying",
      getOptions: () => ({ priority: 10 }),
      handle: async event => {
        sub1Attempts++;
        event.getPayload().items.push("mutated-by-sub1");
        event.addHeaders({ "x-mutated": "true" });
        if (sub1Attempts === 1) {
          throw new Error("transient sub1 failure");
        }
      },
    });

    eventBus.subscribe<LocalUnregisteredEvent>(LocalUnregisteredEvent.NAME, {
      getName: () => "sub-2-isolated",
      getOptions: () => ({ priority: 5 }),
      handle: async event => {
        observedItemsBySub2.push([...event.getPayload().items]);
        expect(event.headers).toBeNull();
      },
    });

    expect(eventBus.hasSubscribers(LocalUnregisteredEvent.NAME)).toBe(true);
    expect(eventBus.getSubscribedEvents()).toEqual([LocalUnregisteredEvent.NAME]);

    let middlewareCalls = 0;
    const mw = {
      beforePublish: async () => {
        middlewareCalls++;
      },
    };
    eventBus.use(mw);
    expect(eventBus.removeMiddleware(mw)).toBe(true);

    await eventBus.publish(
      new LocalUnregisteredEvent("corr-ev", { items: ["original"] }, { id: "ev-local-1" }),
    );

    expect(sub1Attempts).toBe(2);
    expect(observedItemsBySub2).toEqual([["original"]]);
    expect(middlewareCalls).toBe(0);

    // DeadLetterStore clone isolation
    const rawPrimitives = new LocalUnregisteredEvent("corr-dlq", { items: ["a"] }).toPrimitives();
    await deadLetterStore.add(rawPrimitives, "failed");
    rawPrimitives.payload.items.push("mutated-outside");
    const dlqItems = await deadLetterStore.all();
    expect(dlqItems[0]?.primitives.payload.items).toEqual(["a"]);
    dlqItems[0]!.primitives.payload.items.push("mutated-after-all");
    expect((await deadLetterStore.all())[0]?.primitives.payload.items).toEqual(["a"]);

    eventBus.clear();
    expect(eventBus.getSubscribedEvents()).toEqual([]);
    await eventBus.close();
    await commandBus.close();
    await queryBus.close();
  });

  it("supports handler-owned query caching across distinct Query instances, deterministic getIdempotencyKey across timestamps, and handler-level timeout options", async () => {
    const cacheStore = new InMemoryCache<unknown>();
    let queryExecutions = 0;

    class CachedQueryHandler extends AbstractQueryHandler<TestQuery, { value: string }> {
      constructor() {
        super({ cache: true, cacheStore, cacheTtl: 60_000 });
      }
      async execute(query: TestQuery): Promise<{ value: string }> {
        queryExecutions++;
        return { value: `val:${query.getPayload().id}` };
      }
    }

    const cachedQueryHandler = new CachedQueryHandler();
    const res1 = await cachedQueryHandler.handle(
      new TestQuery("corr-a", { id: "item-99" }, { createdAt: new Date(1000) }),
    );
    const res2 = await cachedQueryHandler.handle(
      new TestQuery("corr-b", { id: "item-99" }, { createdAt: new Date(9000) }),
    );
    expect(res1).toEqual({ value: "val:item-99" });
    expect(res2).toEqual({ value: "val:item-99" });
    expect(queryExecutions).toBe(1);

    // Deterministic getIdempotencyKey ignoring createdAt and correlationId
    class IdempCmdHandler extends AbstractCommandHandler<TestCommand, void> {
      async execute(): Promise<void> {}
    }
    const idempHandler = new IdempCmdHandler();
    const cmdAttempt1 = new TestCommand(
      "corr-1",
      { id: "ord-1" },
      { id: "cmd-fixed-id", createdAt: new Date(1000) },
    );
    const cmdAttempt2 = new TestCommand(
      "corr-2",
      { id: "ord-1" },
      { id: "cmd-fixed-id", createdAt: new Date(5000) },
    );
    expect(idempHandler.getIdempotencyKey(cmdAttempt1)).toBe(
      idempHandler.getIdempotencyKey(cmdAttempt2),
    );

    // Handler-level timeout option on AbstractCommandHandler & AbstractQueryHandler
    class SlowTimeoutCmdHandler extends AbstractCommandHandler<TestCommand, void> {
      constructor() {
        super({ timeout: 15 });
      }
      async execute(_cmd: TestCommand, ctx: CommandHandlerContext): Promise<void> {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 200);
          ctx.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(ctx.signal?.reason);
            },
            { once: true },
          );
        });
      }
    }

    class SlowTimeoutQueryHandler extends AbstractQueryHandler<TestQuery, string> {
      constructor() {
        super({ timeout: 15 });
      }
      async execute(_qry: TestQuery, ctx: QueryHandlerContext): Promise<string> {
        return await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => resolve("done"), 200);
          ctx.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(ctx.signal?.reason);
            },
            { once: true },
          );
        });
      }
    }

    await expect(
      new SlowTimeoutCmdHandler().handle(new TestCommand("corr-t", { id: "1" })),
    ).rejects.toThrow("Command timed out after 15ms");

    await expect(
      new SlowTimeoutQueryHandler().handle(new TestQuery("corr-t", { id: "1" })),
    ).rejects.toThrow("Query timed out after 15ms");
  });

  it("clones caller inputs before freezing in ObjectValue/ArrayValue, serializes concurrent sync() in OfflineCommandSync and ErrorTracker, and supports RegExp/predicate ignoredErrors", async () => {
    // 1. ObjectValue & ArrayValue non-mutating input freezing
    class SampleObjVO extends ObjectValue<{ meta: { count: number } }> {
      readonly attributeName = "sampleObj";
      constructor(val: { meta: { count: number } }) {
        super(val, { meta: { count: [{ required: true }, { type: "number" }] } });
      }
    }

    class SampleArrVO extends ArrayValue<{ label: string }> {
      readonly attributeName = "sampleArr";
      readonly isPrimitive = false;
      constructor(val: Array<{ label: string }>) {
        super(val, { label: [{ required: true }, { type: "string" }] });
      }
    }

    const callerObj = { meta: { count: 1 } };
    const objVo = new SampleObjVO(callerObj);
    expect(Object.isFrozen(callerObj)).toBe(false);
    expect(Object.isFrozen(callerObj.meta)).toBe(false);
    expect(Object.isFrozen(objVo.value)).toBe(true);
    expect(Object.isFrozen(objVo.value.meta)).toBe(true);
    callerObj.meta.count = 99;
    expect(objVo.value.meta.count).toBe(1);

    const callerArr = [{ label: "a" }];
    const arrVo = new SampleArrVO(callerArr);
    expect(Object.isFrozen(callerArr)).toBe(false);
    expect(Object.isFrozen(callerArr[0])).toBe(false);
    expect(Object.isFrozen(arrVo.value)).toBe(true);
    expect(Object.isFrozen(arrVo.value[0])).toBe(true);
    callerArr.push({ label: "b" });
    callerArr[0]!.label = "mutated";
    expect(arrVo.value).toEqual([{ label: "a" }]);

    // 2. Concurrent OfflineCommandSync.sync() serialization
    const offlineStore = new InMemoryOfflineStore();
    const commandBus = new InMemoryCommandBus();
    const dispatchedIds: string[] = [];

    class DelayedCmdHandler extends AbstractCommandHandler<TestCommand, void> {
      async execute(command: TestCommand): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 15));
        dispatchedIds.push(command.getPayload().id);
      }
    }
    commandBus.register(TestCommand.TYPE, new DelayedCmdHandler());

    const syncer = new OfflineCommandSync(offlineStore, commandBus, {
      hydrateCommand: (p) => TestCommand.fromPrimitives(p),
    });

    await syncer.enqueueCommand(new TestCommand("corr-1", { id: "cmd-1" }));
    await syncer.enqueueCommand(new TestCommand("corr-2", { id: "cmd-2" }));

    const [syncRes1, syncRes2] = await Promise.all([syncer.sync(), syncer.sync()]);
    expect(syncRes1.processed + syncRes2.processed).toBe(2);
    expect(dispatchedIds).toEqual(["cmd-1", "cmd-2"]);
    await commandBus.close();

    // 3. Concurrent ErrorTracker.sync() serialization + RegExp & predicate ignoredErrors
    const errorStore = new InMemoryErrorStore();
    const uploadedBatches: string[][] = [];
    const tracker = new ErrorTracker(
      errorStore,
      {
        upload: async (errors) => {
          await new Promise((resolve) => setTimeout(resolve, 15));
          uploadedBatches.push(
            errors.map((e) => (typeof e.error === "string" ? e.error : e.error.message)),
          );
        },
      },
      undefined,
      {
        ignoredErrors: [
          /^ResizeObserver loop/i,
          (err) => typeof err === "object" && "code" in err && (err as { code?: string }).code === "E_SKIP",
        ],
      },
    );

    await tracker.track("ResizeObserver loop completed with undelivered notifications");
    await tracker.track(Object.assign(new Error("Skipped by predicate"), { code: "E_SKIP" }));
    await tracker.track(new Error("Real failure 1"));
    await tracker.track("Real failure 2");

    await Promise.all([tracker.sync(), tracker.sync()]);
    expect(uploadedBatches).toEqual([["Real failure 1", "Real failure 2"]]);
    expect(await errorStore.all()).toEqual([]);
  });

  it("supports toString/toJSON, reference isolation, and non-string guards on ValueObjects, plus deep Criteria and Command/Query/DomainEvent isolation", () => {
    class TestEmailVO extends EmailValue {
      readonly attributeName = "email";
    }
    class TestPhoneVO extends PhoneValue {
      readonly attributeName = "phone";
    }
    class TestSlugVO extends SlugValue {
      readonly attributeName = "slug";
    }
    class TestEnumVO extends EnumValue<readonly ["draft", "published"]> {
      readonly attributeName = "status";
      constructor(val: "draft" | "published") {
        super(["draft", "published"] as const, val);
      }
    }
    class TestDateVO extends DateValue {
      readonly attributeName = "date";
    }
    class TestCoordsVO extends CoordinatesValue {
      readonly attributeName = "coords";
    }
    class TestUrlVO extends URLValue {
      readonly attributeName = "url";
    }
    class TestHtmlVO extends HTMLValue {
      readonly attributeName = "html";
    }
    class TestMarkdownVO extends MarkdownValue {
      readonly attributeName = "markdown";
    }

    const emailVo = new TestEmailVO("dev@example.com");
    const phoneVo = new TestPhoneVO("+14155552671");
    const slugVo = new TestSlugVO("my-slug");
    const enumVo = new TestEnumVO("published");
    const rawDate = new Date("2026-05-01T12:00:00.000Z");
    const dateVo = new TestDateVO(rawDate);
    const rawCoords = { latitude: 37.7749, longitude: -122.4194 };
    const coordsVo = new TestCoordsVO(rawCoords);
    const rawUrl = new URL("https://example.com/original");
    const urlVo = new TestUrlVO(rawUrl, ["example.com"]);

    // Mutate caller-owned Date, Coordinates object, and URL after construction
    rawDate.setUTCFullYear(1999);
    rawCoords.latitude = 0;
    rawUrl.pathname = "/mutated";

    expect(dateVo.toPrimitives()).toBe("2026-05-01T12:00:00.000Z");
    expect(coordsVo.latitude).toBe(37.7749);
    expect(urlVo.toPrimitives()).toBe("https://example.com/original");

    // Verify JSON.stringify and String() across all value objects
    expect(JSON.parse(JSON.stringify({ emailVo, phoneVo, slugVo, enumVo, dateVo, coordsVo, urlVo }))).toEqual({
      emailVo: "dev@example.com",
      phoneVo: "+14155552671",
      slugVo: "my-slug",
      enumVo: "published",
      dateVo: "2026-05-01T12:00:00.000Z",
      coordsVo: { latitude: 37.7749, longitude: -122.4194 },
      urlVo: "https://example.com/original",
    });
    expect(String(emailVo)).toBe("dev@example.com");
    expect(String(enumVo)).toBe("published");
    expect(String(urlVo)).toBe("https://example.com/original");

    // Verify non-string coercion guards and invalid Date/URL bounds
    expect(new TestEmailVO(["dev@example.com"] as unknown as string).isValid).toBe(false);
    expect(new TestPhoneVO(["+14155552671"] as unknown as string).isValid).toBe(false);
    expect(new TestSlugVO(["valid-slug"] as unknown as string).isValid).toBe(false);
    expect(new TestHtmlVO(["<p>hi</p>"] as unknown as string).isValid).toBe(false);
    expect(new TestMarkdownVO(["# title"] as unknown as string).isValid).toBe(false);
    expect(new TestUrlVO("https://example.com" as unknown as URL).isValid).toBe(false);
    expect(new TestDateVO(new Date("2026-05-01T00:00:00.000Z"), new Date("invalid")).isValid).toBe(false);

    // Criteria deep filter value isolation
    const statusList = ["open", "pending"];
    const criteria = Criteria.none().where("status", "IN", statusList);
    statusList.push("closed");
    expect(criteria.filters[0]?.value).toEqual(["open", "pending"]);

    const criteriaPrims = criteria.toPrimitives();
    (criteriaPrims.filters[0]?.value as string[]).push("tampered");
    expect(criteria.filters[0]?.value).toEqual(["open", "pending"]);

    // Command, Query, and DomainEvent metadata/payload isolation
    const headers = { "x-trace": "t-1" };
    const context = { nested: { role: "admin" } };
    const cmd = new TestCommand("corr-iso", { id: "c-1" }, { headers, context });
    const qry = new TestQuery("corr-iso", { id: "q-1" }, { headers, context });
    const evt = new TestDomainEvent("corr-iso", { id: "e-1" }, { headers, context });

    headers["x-trace"] = "mutated";
    context.nested.role = "guest";

    expect(cmd.headers).toEqual({ "x-trace": "t-1" });
    expect(cmd.context).toEqual({ nested: { role: "admin" } });
    expect(qry.headers).toEqual({ "x-trace": "t-1" });
    expect(evt.context).toEqual({ nested: { role: "admin" } });

    const cmdPrims = cmd.toPrimitives();
    cmdPrims.headers!["x-trace"] = "mutated-again";
    cmdPrims.payload.id = "mutated-id";
    expect(cmd.headers).toEqual({ "x-trace": "t-1" });
    expect(cmd.getPayload().id).toBe("c-1");
  });
});
