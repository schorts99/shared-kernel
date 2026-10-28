import {
  AbstractQueryHandler,
  InMemoryCache,
  InMemoryIdempotencyStore,
  InMemoryQueryBus,
  Result,
  UUIDValue,
} from "../src";
import type {
  QueryHandlerContext,
} from "../src";
import { NodeExecutionContext } from "../src/node";
import {
  registerTestMessages,
  TestQuery,
  MoneyValue,
  OrderEntity,
} from "./support/fixtures";

beforeAll(registerTestMessages);

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
