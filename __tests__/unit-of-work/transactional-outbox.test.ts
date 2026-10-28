import {
  AggregateRoot,
  DomainEventRegistry,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemoryUnitOfWorkRunner,
  UUIDValue,
} from "../../src";
import { NodeExecutionContext } from "../../src/node";
import {
  registerTestMessages,
  TestDomainEvent,
  TestUUIDValue,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("Transactional outbox", () => {
  it("stages domain events on commit, publishes post-commit, and discards them on rollback", async () => {
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
      subscribedTo: () => [TestDomainEvent.NAME],
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

    const accountId = new TestUUIDValue("123e4567-e89b-12d3-a456-426614174010");
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
});
