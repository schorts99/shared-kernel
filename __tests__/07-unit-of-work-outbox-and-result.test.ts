import {
  AggregateRoot,
  DomainEventRegistry,
  FloatValue,
  HTMLValue,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemoryPubSub,
  InMemoryUnitOfWorkRunner,
  Logger,
  LoggingMailer,
  MarkdownValue,
  Result,
  UUIDValue,
} from "../src";
import type {
  UnitOfWork,
} from "../src";
import { NodeExecutionContext } from "../src/node";
import {
  registerTestMessages,
  TestDomainEvent,
} from "./support/fixtures";

beforeAll(registerTestMessages);

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
