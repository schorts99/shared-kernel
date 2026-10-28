import {
  AbstractCommandHandler,
  AbstractQueryHandler,
  CrossDispatchCycleError,
  InMemoryCommandBus,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemoryIdempotencyStore,
  InMemoryQueryBus,
  InMemorySagaStateStore,
  Saga,
} from "../../src";
import type {
  CommandHandlerContext,
} from "../../src";
import { NodeExecutionContext } from "../../src/node";
import {
  registerTestMessages,
  SecondaryCommand,
  TestCommand,
  TestDomainEvent,
  TestQuery,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("Cross-dispatch cycle detection", () => {
  it("detects Command -> Query -> Command cycles immediately", async () => {
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

  it("detects diamond and mutual-wait cycles across shared in-flight idempotency work", async () => {
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

  it("detects concurrency pool exhaustion cycles across buses", async () => {
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

  it("detects reentrant saga self-deadlock across the event bus and command bus", async () => {
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
