---
name: add-command
description: Add a command and its handler with @schorts/shared-kernel — a plain-data command class, an AbstractCommandHandler with validate/authorize/execute, domain events handed to the bus through context.events, registration on InMemoryCommandBus, and an end-to-end test. Use for any operation that changes state.
---

<!-- check-uses: ../create-aggregate/SKILL.md -->

# Add a command

A command asks the application to change something. This skill adds `PlaceOrder`, using the `Order` aggregate and `OrderRepository` from [create-aggregate](../create-aggregate/SKILL.md).

## 1. The command

- Extend `AbstractCommand<Payload>` and return a stable, namespaced `getType()`.
- The payload is plain data. Build value objects and aggregates in the handler, not here.
- Do not add a constructor; callers use the inherited `new PlaceOrder(correlationId, payload, metadata?)`, which the bus also uses to rebuild the command.

```ts
// file: application/place-order.ts
import { AbstractCommand } from "@schorts/shared-kernel/cqrs";
import type { OrderLine } from "../domain/order.js";

export type PlaceOrderPayload = {
  orderId: string;
  customerId: string;
  lines: OrderLine[];
};

export class PlaceOrder extends AbstractCommand<PlaceOrderPayload> {
  static readonly TYPE = "orders.place_order";

  getType(): string {
    return PlaceOrder.TYPE;
  }
}
```

## 2. The handler

- Extend `AbstractCommandHandler<Command, Result>` and implement `protected execute`. The bus calls `handle`, which runs `validate` and `authorize` first.
- Throw `CommandValidationError` / `CommandAuthorizationError` for failures callers should see as such. Anything else reaches the caller wrapped in `CommandExecutionError`, so translate expected domain errors.
- Hand recorded events to the bus with `context.events.push(...)`. Never publish from the handler.
- Return plain data (an ID, a summary), not the aggregate.

```ts
// file: application/place-order-handler.ts
import {
  AbstractCommandHandler,
  CommandAuthorizationError,
  CommandValidationError,
} from "@schorts/shared-kernel/cqrs";
import type { CommandHandlerContext } from "@schorts/shared-kernel/cqrs";
import { InvalidOrder, Order } from "../domain/order.js";
import type { OrderRepository } from "../domain/order-repository.js";
import { PlaceOrder } from "./place-order.js";

export class PlaceOrderHandler extends AbstractCommandHandler<PlaceOrder, { orderId: string }> {
  constructor(private readonly orders: OrderRepository) {
    super();
  }

  override async validate(command: PlaceOrder): Promise<void> {
    if (command.getPayload().lines.length === 0) {
      throw new CommandValidationError("An order needs at least one line", "EMPTY_ORDER", { field: "lines" });
    }
  }

  override async authorize(command: PlaceOrder): Promise<void> {
    const { userId } = command.getMetadata();
    if (userId !== null && userId !== command.getPayload().customerId) {
      throw new CommandAuthorizationError("Customers can only place their own orders");
    }
  }

  protected async execute(command: PlaceOrder, context: CommandHandlerContext): Promise<{ orderId: string }> {
    const { orderId, customerId, lines } = command.getPayload();
    let order: Order;
    try {
      order = Order.place({ id: orderId, customerId, lines }, context.correlationId);
    } catch (error) {
      if (error instanceof InvalidOrder) {
        throw new CommandValidationError(error.message, "INVALID_ORDER");
      }
      throw error;
    }

    await this.orders.save(order);
    context.events.push(...order.pullDomainEvents());

    return { orderId: order.id.value };
  }
}
```

## 3. Wire it up

Create one command bus per process. Turn on `autoPublishEvents` so events in `context.events` are published after the handler succeeds. Register the command and its events so they can be rebuilt from primitives.

```ts
// file: bootstrap/orders-module.ts
import { CommandRegistry, InMemoryCommandBus } from "@schorts/shared-kernel/cqrs";
import { InMemoryEventBus, InMemoryEventStore } from "@schorts/shared-kernel/event-bus";
import { NodeExecutionContext } from "@schorts/shared-kernel/node";
import { PlaceOrder } from "../application/place-order.js";
import { PlaceOrderHandler } from "../application/place-order-handler.js";
import type { OrderRepository } from "../domain/order-repository.js";
import { registerOrderEvents } from "./register-order-events.js";

export function createOrdersModule(orders: OrderRepository) {
  const executionContext = new NodeExecutionContext();
  const eventBus = new InMemoryEventBus(new InMemoryEventStore(), {}, undefined, undefined, executionContext);
  const commandBus = new InMemoryCommandBus({ eventBus, executionContext });
  commandBus.setConfig({ autoPublishEvents: true });

  CommandRegistry.register(PlaceOrder.TYPE, PlaceOrder);
  registerOrderEvents();
  commandBus.register(PlaceOrder.TYPE, new PlaceOrderHandler(orders));

  return { commandBus, eventBus };
}
```

Dispatch from a controller, job, or subscriber. Pass the caller's correlation ID and identity:

```ts
// file: http/place-order-route.ts
import type { CommandBus } from "@schorts/shared-kernel/cqrs";
import { PlaceOrder } from "../application/place-order.js";
import type { PlaceOrderPayload } from "../application/place-order.js";

export async function placeOrderRoute(
  commandBus: CommandBus,
  request: { requestId: string; userId: string; body: PlaceOrderPayload },
) {
  return commandBus.dispatch<PlaceOrder, { orderId: string }>(
    new PlaceOrder(request.requestId, request.body, { userId: request.userId, requestId: request.requestId }),
  );
}
```

`NodeExecutionContext` is Node-only. In browsers, omit `executionContext`.

## 4. Test it end to end

Dispatch through a real bus with in-memory adapters, then assert on stored state and published events:

```ts
// file: application/place-order.test.ts
import { CommandValidationError } from "@schorts/shared-kernel/cqrs";
import { OrderPlaced } from "../domain/order-events.js";
import { OrderId } from "../domain/order-id.js";
import { InMemoryOrderRepository } from "../infrastructure/in-memory-order-repository.js";
import { createOrdersModule } from "../bootstrap/orders-module.js";
import { PlaceOrder } from "./place-order.js";

const orderId = "0b8b1a3e-6a8f-4a5e-9c55-3f1f1e6b2a10";

describe("PlaceOrder", () => {
  it("stores the order and publishes OrderPlaced", async () => {
    const orders = new InMemoryOrderRepository();
    const { commandBus, eventBus } = createOrdersModule(orders);
    const published: string[] = [];
    eventBus.subscribe<OrderPlaced>(OrderPlaced.NAME, {
      getName: () => "test-recorder",
      subscribedTo: () => [OrderPlaced.NAME],
      handle: async event => {
        published.push(event.getPayload().orderId);
      },
    });

    const result = await commandBus.dispatch(
      new PlaceOrder("corr-1", { orderId, customerId: "c-1", lines: [{ sku: "BOOK-1", quantity: 1, unitPrice: 10 }] }),
    );

    expect(result).toEqual({ orderId });
    expect((await orders.findById(new OrderId(orderId)))?.total).toBe(10);
    expect(published).toEqual([orderId]);
    await commandBus.close();
  });

  it("rejects an empty order with CommandValidationError", async () => {
    const { commandBus } = createOrdersModule(new InMemoryOrderRepository());

    await expect(
      commandBus.dispatch(new PlaceOrder("corr-2", { orderId, customerId: "c-1", lines: [] })),
    ).rejects.toBeInstanceOf(CommandValidationError);
    await commandBus.close();
  });
});
```

## Optional: make it idempotent

When a command may be delivered twice, give the handler an idempotency store. Override `getIdempotencyKey` to use a key the client resends, such as the request ID:

```ts no-check
super({ idempotent: true, idempotencyStore });

override getIdempotencyKey(command: PlaceOrder): string | null {
  return command.getMetadata().requestId ? `place-order:${command.getMetadata().requestId}` : null;
}
```

## Optional: run it in a transaction

Pass `createUnitOfWork` to the bus and set `transactional: true`. The handler then receives `context.unitOfWork`; pass it to every repository or DAO call, and events are published only after the commit. See [use-unit-of-work](../use-unit-of-work/SKILL.md).

## Checklist

- [ ] Command extends `AbstractCommand<Payload>`, payload is plain data, `TYPE` is namespaced.
- [ ] Handler implements `protected execute`; checks live in `validate`/`authorize`.
- [ ] Expected failures thrown as `CommandValidationError`/`CommandAuthorizationError`.
- [ ] Events pushed to `context.events`; the bus has `autoPublishEvents` and an `eventBus`.
- [ ] Command and events registered at startup; handler registered once.
- [ ] End-to-end test through the bus with in-memory adapters.
