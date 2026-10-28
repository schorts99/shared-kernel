import {
  InMemoryCache,
  Result,
  UUIDValue,
} from "../../src";
import {
  MoneyValue,
  OrderEntity,
  TestUUIDValue,
} from "../support/fixtures";

describe("InMemoryCache", () => {
  it("clones domain classes on write and read and rejects unsupported values without replacing entries", async () => {
    const cache = new InMemoryCache<unknown>();

    const entity = new OrderEntity(new TestUUIDValue("123e4567-e89b-12d3-a456-426614174000"), 100, ["item-1"]);
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
  });

  it("supports a custom copier", async () => {
    const customCache = new InMemoryCache<{ fn: () => number }>({
      cloneValue: val => ({ fn: val.fn }),
    });
    await customCache.set("fn-key", { fn: () => 42 });
    const customRead = await customCache.get("fn-key");
    expect(customRead?.fn()).toBe(42);
  });
});
