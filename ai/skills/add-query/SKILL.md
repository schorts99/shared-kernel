---
name: add-query
description: Add a query and its handler with @schorts/shared-kernel — a plain-data query class, an AbstractQueryHandler returning a read model, registration on InMemoryQueryBus, optional result caching with tags and invalidation, and a test. Use for any read that should go through the query bus.
---

<!-- check-uses: ../create-aggregate/SKILL.md -->

# Add a query

A query returns data and never changes state. This skill adds `GetOrder`, reading through the `OrderRepository` from [create-aggregate](../create-aggregate/SKILL.md).

## 1. The query and its result

Return a read model (plain data shaped for the caller), not the aggregate.

```ts
// file: application/get-order.ts
import { AbstractQuery } from "@schorts/shared-kernel/cqrs";

export type GetOrderPayload = { orderId: string };

export type OrderView = {
  id: string;
  status: string;
  total: number;
  lineCount: number;
};

export class GetOrder extends AbstractQuery<GetOrderPayload> {
  static readonly TYPE = "orders.get_order";

  getType(): string {
    return GetOrder.TYPE;
  }
}
```

## 2. The handler

Implement `protected execute`. Validate input in `validate` with `QueryValidationError`; return `null` (or a `Result`) for "not found" rather than throwing.

```ts
// file: application/get-order-handler.ts
import { AbstractQueryHandler, QueryValidationError } from "@schorts/shared-kernel/cqrs";
import { OrderId } from "../domain/order-id.js";
import type { OrderRepository } from "../domain/order-repository.js";
import { GetOrder } from "./get-order.js";
import type { OrderView } from "./get-order.js";

export class GetOrderHandler extends AbstractQueryHandler<GetOrder, OrderView | null> {
  constructor(private readonly orders: OrderRepository) {
    super();
  }

  override async validate(query: GetOrder): Promise<void> {
    if (!new OrderId(query.getPayload().orderId).isValid) {
      throw new QueryValidationError("orderId must be a UUID", "INVALID_ORDER_ID", { field: "orderId" });
    }
  }

  protected async execute(query: GetOrder): Promise<OrderView | null> {
    const order = await this.orders.findById(new OrderId(query.getPayload().orderId));
    if (!order) return null;

    const data = order.toPrimitives();
    return { id: data.id, status: data.status, total: order.total, lineCount: data.lines.length };
  }
}
```

## 3. Register, with optional caching

The cache policy's `getKey` names the resource; the bus already scopes keys by query type, user, tenant, and metadata. Tags let you invalidate related entries. Caching is off until you enable it on the bus.

```ts
// file: bootstrap/order-queries.ts
import { InMemoryQueryBus } from "@schorts/shared-kernel/cqrs";
import { NodeExecutionContext } from "@schorts/shared-kernel/node";
import { GetOrder } from "../application/get-order.js";
import type { OrderView } from "../application/get-order.js";
import { GetOrderHandler } from "../application/get-order-handler.js";
import type { OrderRepository } from "../domain/order-repository.js";

export function createOrderQueries(orders: OrderRepository) {
  const queryBus = new InMemoryQueryBus({ executionContext: new NodeExecutionContext() });
  queryBus.setConfig({ enableCaching: true, cacheTtl: 60_000 });

  queryBus.register<GetOrder, OrderView | null>(GetOrder.TYPE, new GetOrderHandler(orders), {
    getKey: query => query.getPayload().orderId,
    getTags: query => [`order:${query.getPayload().orderId}`],
    shouldCache: (_query, result) => result !== null,
  });

  return queryBus;
}
```

When the order changes, drop its entries. A subscriber to the change event is the usual place:

```ts
// file: application/invalidate-order-cache.ts
import { AbstractEventSubscriber } from "@schorts/shared-kernel/event-bus";
import type { InMemoryQueryBus } from "@schorts/shared-kernel/cqrs";
import { OrderCancelled } from "../domain/order-events.js";

export class InvalidateOrderCache extends AbstractEventSubscriber<OrderCancelled> {
  constructor(private readonly queryBus: InMemoryQueryBus) {
    super();
  }

  subscribedTo(): string[] {
    return [OrderCancelled.NAME];
  }

  async handle(event: OrderCancelled): Promise<void> {
    await this.queryBus.invalidateCache([`order:${event.getPayload().orderId}`]);
  }
}
```

## 4. Dispatch

```ts
// file: http/get-order-route.ts
import type { QueryBus } from "@schorts/shared-kernel/cqrs";
import { GetOrder } from "../application/get-order.js";
import type { OrderView } from "../application/get-order.js";

export async function getOrderRoute(queryBus: QueryBus, request: { requestId: string; orderId: string }) {
  const view = await queryBus.dispatch<GetOrder, OrderView | null>(
    new GetOrder(request.requestId, { orderId: request.orderId }),
  );
  return view ? { status: 200, body: view } : { status: 404, body: null };
}
```

## 5. Test it

```ts
// file: application/get-order.test.ts
import { QueryValidationError } from "@schorts/shared-kernel/cqrs";
import { Order } from "../domain/order.js";
import { InMemoryOrderRepository } from "../infrastructure/in-memory-order-repository.js";
import { createOrderQueries } from "../bootstrap/order-queries.js";
import { GetOrder } from "./get-order.js";
import type { OrderView } from "./get-order.js";

const orderId = "0b8b1a3e-6a8f-4a5e-9c55-3f1f1e6b2a10";

describe("GetOrder", () => {
  it("returns a view, caches it, and serves fresh data after invalidation", async () => {
    const orders = new InMemoryOrderRepository();
    const order = Order.place({ id: orderId, customerId: "c-1", lines: [{ sku: "A", quantity: 2, unitPrice: 5 }] }, "corr-1");
    await orders.save(order);
    const queryBus = createOrderQueries(orders);
    const getOrder = () => queryBus.dispatch<GetOrder, OrderView | null>(new GetOrder("corr-2", { orderId }));

    expect(await getOrder()).toEqual({ id: orderId, status: "placed", total: 10, lineCount: 1 });

    order.cancel("changed mind", "corr-3");
    await orders.save(order);
    expect((await getOrder())?.status).toBe("placed");

    await queryBus.invalidateCache([`order:${orderId}`]);
    expect((await getOrder())?.status).toBe("cancelled");
    await queryBus.close();
  });

  it("returns null for unknown orders and rejects malformed IDs", async () => {
    const queryBus = createOrderQueries(new InMemoryOrderRepository());

    expect(await queryBus.dispatch(new GetOrder("corr-4", { orderId }))).toBeNull();
    await expect(queryBus.dispatch(new GetOrder("corr-5", { orderId: "nope" }))).rejects.toBeInstanceOf(QueryValidationError);
    await queryBus.close();
  });
});
```

## Checklist

- [ ] Query extends `AbstractQuery<Payload>`; handler implements `protected execute` and never changes state.
- [ ] Handler returns a plain read model.
- [ ] Caching: policy with `getKey`/`getTags`, `enableCaching: true` on the bus, and invalidation on the events that change the data.
- [ ] Tests cover the happy path, "not found", validation, and cache invalidation if used.
