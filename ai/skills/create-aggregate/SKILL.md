---
name: create-aggregate
description: Add an aggregate root with @schorts/shared-kernel — an ID value object, domain events, intention-revealing methods that record events, toPrimitives/fromPrimitives persistence, and a repository interface. Use when modeling a consistency boundary such as an order, account, or booking.
---

# Create an aggregate

An aggregate guards its invariants, changes state only through methods, and records a domain event for every change. This skill builds an `Order` aggregate.

Use `AggregateRoot` when you need event recording and a `version`. For a plain record stored through a `DAO`, extend `Entity<IdValue, Model>` instead; it has the same `recordDomainEvent`/`pullDomainEvents` methods, and a DAO can only store entities.

## 1. ID value object

```ts
// file: domain/order-id.ts
import { UUIDValue } from "@schorts/shared-kernel/value-objects";

export class OrderId extends UUIDValue {
  readonly attributeName = "orderId";
}
```

## 2. Domain events

One class per fact, named in the past tense, with a plain-data payload and a stable `NAME`. Keep the inherited `(correlationId, payload, customMetadata?)` constructor.

```ts
// file: domain/order-events.ts
import { DomainEvent } from "@schorts/shared-kernel/domain-events";

export type OrderPlacedPayload = { orderId: string; customerId: string; total: number };

export class OrderPlaced extends DomainEvent<OrderPlacedPayload> {
  static readonly NAME = "orders.order_placed";

  getEventName(): string {
    return OrderPlaced.NAME;
  }
}

export type OrderCancelledPayload = { orderId: string; reason: string };

export class OrderCancelled extends DomainEvent<OrderCancelledPayload> {
  static readonly NAME = "orders.order_cancelled";

  getEventName(): string {
    return OrderCancelled.NAME;
  }
}
```

## 3. The aggregate

- Keep state private and expose read-only getters.
- Create through a static factory that checks invariants and records the creation event.
- Each change method checks the current state, mutates, then calls `recordDomainEvent`.
- `toPrimitives()` includes `version`. `createId` and `restoreFromPrimitives` let the inherited static `fromPrimitives` rebuild the aggregate; `createId` runs on the prototype, so it must not use instance fields.

```ts
// file: domain/order.ts
import { AggregateRoot } from "@schorts/shared-kernel/aggregates";
import { OrderId } from "./order-id.js";
import { OrderCancelled, OrderPlaced } from "./order-events.js";

export type OrderLine = { sku: string; quantity: number; unitPrice: number };
export type OrderStatus = "placed" | "cancelled";

export type OrderPrimitives = {
  id: string;
  version: number;
  customerId: string;
  status: OrderStatus;
  lines: OrderLine[];
};

export class InvalidOrder extends Error {
  override name = "InvalidOrder";
}

export class Order extends AggregateRoot<OrderId> {
  private customerId = "";
  private status: OrderStatus = "placed";
  private lines: OrderLine[] = [];

  static place(
    input: { id: string; customerId: string; lines: OrderLine[] },
    correlationId: string,
  ): Order {
    const id = new OrderId(input.id);
    if (!id.isValid) throw new InvalidOrder(`Order ID ${input.id} is not a UUID`);
    if (input.lines.length === 0) throw new InvalidOrder("An order needs at least one line");
    if (input.lines.some(line => line.quantity < 1 || line.unitPrice < 0)) {
      throw new InvalidOrder("Quantities must be positive and prices non-negative");
    }

    const order = new Order(id);
    order.customerId = input.customerId;
    order.lines = input.lines.map(line => ({ ...line }));
    order.recordDomainEvent(
      new OrderPlaced(correlationId, { orderId: id.value, customerId: input.customerId, total: order.total }),
    );
    return order;
  }

  get total(): number {
    return this.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  }

  get currentStatus(): OrderStatus {
    return this.status;
  }

  cancel(reason: string, correlationId: string): void {
    if (this.status === "cancelled") throw new InvalidOrder("Order is already cancelled");

    this.status = "cancelled";
    this.recordDomainEvent(new OrderCancelled(correlationId, { orderId: this.id.value, reason }));
  }

  toPrimitives(): OrderPrimitives {
    return {
      id: this.id.value,
      version: this.version,
      customerId: this.customerId,
      status: this.status,
      lines: this.lines.map(line => ({ ...line })),
    };
  }

  protected override createId(rawId: unknown): OrderId {
    return new OrderId(String(rawId));
  }

  protected override restoreFromPrimitives(data: OrderPrimitives): void {
    this.customerId = data.customerId;
    this.status = data.status;
    this.lines = data.lines.map(line => ({ ...line }));
  }
}
```

## 4. Repository

Define the port next to the aggregate. The infrastructure implementation stores primitives and rebuilds with `Order.fromPrimitives`, which also restores `version` and marks the aggregate as having no uncommitted changes.

```ts
// file: domain/order-repository.ts
import type { Order } from "./order.js";
import type { OrderId } from "./order-id.js";

export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
```

```ts
// file: infrastructure/in-memory-order-repository.ts
import { Order } from "../domain/order.js";
import type { OrderPrimitives } from "../domain/order.js";
import type { OrderId } from "../domain/order-id.js";
import type { OrderRepository } from "../domain/order-repository.js";

export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, OrderPrimitives>();

  async findById(id: OrderId): Promise<Order | null> {
    const row = this.rows.get(id.value);
    return row ? Order.fromPrimitives(structuredClone(row)) : null;
  }

  async save(order: Order): Promise<void> {
    this.rows.set(order.id.value, structuredClone(order.toPrimitives()));
    order.markChangesCommitted();
  }
}
```

A database implementation does the same with a table or collection. Do not let the domain import it.

## 5. Register the events

Register every event class at startup so stores, outboxes, and replays can rebuild them:

```ts
// file: bootstrap/register-order-events.ts
import { DomainEventRegistry } from "@schorts/shared-kernel/domain-events";
import { OrderCancelled, OrderPlaced } from "../domain/order-events.js";

export function registerOrderEvents(): void {
  DomainEventRegistry.register(OrderPlaced.NAME, OrderPlaced);
  DomainEventRegistry.register(OrderCancelled.NAME, OrderCancelled);
}
```

## 6. Test it

Call the aggregate's methods and assert on the events it records:

```ts
// file: domain/order.test.ts
import { InvalidOrder, Order } from "./order.js";
import { OrderCancelled, OrderPlaced } from "./order-events.js";
import { InMemoryOrderRepository } from "../infrastructure/in-memory-order-repository.js";

const orderId = "0b8b1a3e-6a8f-4a5e-9c55-3f1f1e6b2a10";
const lines = [{ sku: "BOOK-1", quantity: 2, unitPrice: 15 }];

describe("Order", () => {
  it("records OrderPlaced when placed", () => {
    const order = Order.place({ id: orderId, customerId: "c-1", lines }, "corr-1");
    const [event] = order.pullDomainEvents();

    expect(event).toBeInstanceOf(OrderPlaced);
    expect((event as OrderPlaced).getPayload()).toEqual({ orderId, customerId: "c-1", total: 30 });
    expect(event?.correlationId).toBe("corr-1");
    expect(order.version).toBe(1);
  });

  it("rejects empty orders and double cancellation", () => {
    expect(() => Order.place({ id: orderId, customerId: "c-1", lines: [] }, "corr-1")).toThrow(InvalidOrder);

    const order = Order.place({ id: orderId, customerId: "c-1", lines }, "corr-1");
    order.cancel("customer request", "corr-2");
    expect(() => order.cancel("again", "corr-3")).toThrow(InvalidOrder);
    expect(order.pullDomainEvents().map(e => e.getEventName())).toEqual([OrderPlaced.NAME, OrderCancelled.NAME]);
  });

  it("survives a repository round trip with its version", async () => {
    const repository = new InMemoryOrderRepository();
    const order = Order.place({ id: orderId, customerId: "c-1", lines }, "corr-1");
    await repository.save(order);

    const loaded = await repository.findById(order.id);
    expect(loaded?.equals(order)).toBe(true);
    expect(loaded?.toPrimitives()).toEqual(order.toPrimitives());
    expect(loaded?.hasUncommittedChanges).toBe(false);
  });
});
```

## Checklist

- [ ] ID value object with `attributeName`.
- [ ] Past-tense events with plain payloads, a `NAME`, and registration at startup.
- [ ] State changes only through methods that check invariants and record events.
- [ ] `toPrimitives()` includes `version`; `createId` and `restoreFromPrimitives` implemented.
- [ ] Repository interface in the domain, implementation in infrastructure.
- [ ] Tests assert on recorded events and the persistence round trip.
