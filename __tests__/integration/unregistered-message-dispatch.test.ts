import {
  AbstractCommand,
  AbstractQuery,
  DomainEvent,
  InMemoryCommandBus,
  InMemoryDeadLetterStore,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemoryQueryBus,
} from "../../src";
import { NodeExecutionContext } from "../../src/node";

describe("Unregistered message dispatch", () => {
  it("dispatches messages via constructor fromPrimitives, isolates concurrent subscribers, and supports dead-letter helpers", async () => {
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
      subscribedTo: () => [LocalUnregisteredEvent.NAME],
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
      subscribedTo: () => [LocalUnregisteredEvent.NAME],
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
    const itemsOf = (payload: unknown) => (payload as { items: string[] }).items;
    itemsOf(rawPrimitives.payload).push("mutated-outside");
    const dlqItems = await deadLetterStore.all();
    expect(itemsOf(dlqItems[0]?.primitives.payload)).toEqual(["a"]);
    itemsOf(dlqItems[0]!.primitives.payload).push("mutated-after-all");
    expect(itemsOf((await deadLetterStore.all())[0]?.primitives.payload)).toEqual(["a"]);

    eventBus.clear();
    expect(eventBus.getSubscribedEvents()).toEqual([]);
    await eventBus.close();
    await commandBus.close();
    await queryBus.close();
  });
});
