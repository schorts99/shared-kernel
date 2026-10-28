import {
  AbstractQueryHandler,
  InMemoryCache,
  InMemoryIdempotencyStore,
  InMemoryQueryBus,
} from "../../src";
import type {
  QueryHandlerContext,
} from "../../src";
import { NodeExecutionContext } from "../../src/node";
import {
  OrderEntity,
  registerTestMessages,
  TestQuery,
  TestUUIDValue,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("InMemoryQueryBus isolation", () => {
  it("isolates domain objects in InMemoryQueryBus and InMemoryIdempotencyStore", async () => {
    const executionContext = new NodeExecutionContext();
    const queryBus = new InMemoryQueryBus({ executionContext });
    queryBus.setConfig({ enableCaching: true, cacheTtl: 60_000 });

    class GetOrderQueryHandler extends AbstractQueryHandler<TestQuery, OrderEntity> {
      async execute(query: TestQuery, _context: QueryHandlerContext): Promise<OrderEntity> {
        return new OrderEntity(
          new TestUUIDValue("123e4567-e89b-12d3-a456-426614174000"),
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

  it("shares handler-owned query cache entries across distinct Query instances", async () => {
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
  });
});
