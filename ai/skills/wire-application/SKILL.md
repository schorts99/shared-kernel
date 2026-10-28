---
name: wire-application
description: Wire @schorts/shared-kernel into an application — one composition root that creates the event, command, and query buses with shared logger and execution context, registers messages and handlers in the right order, subscribes subscribers and sagas, and shuts everything down cleanly. Use when starting a new service or adding the kernel to an existing one.
---

<!-- check-uses: ../create-aggregate/SKILL.md -->
<!-- check-uses: ../add-command/SKILL.md -->
<!-- check-uses: ../add-query/SKILL.md -->
<!-- check-uses: ../add-event-subscriber/SKILL.md -->

# Wire the application

Create the kernel's infrastructure once, in a composition root, and pass it to the parts of the app that need it. This skill assembles the pieces from [add-command](../add-command/SKILL.md), [add-query](../add-query/SKILL.md), and [add-event-subscriber](../add-event-subscriber/SKILL.md).

## Order of setup

1. Infrastructure: logger, execution context, stores.
2. Buses: event bus first (the command bus depends on it), then the command and query buses, then their config.
3. Registries: every command, query, and event type that is stored, replayed, or recovered.
4. Handlers, one per command and query type.
5. Subscribers, then sagas (after the handlers for the commands they dispatch).
6. If the event bus uses `autoReplay`, call `await eventBus.ready()` last.

Shut down in reverse: stop accepting requests, close the command and query buses, then the event bus.

## The composition root

```ts
// file: main/container.ts
import { CommandRegistry, InMemoryCommandBus, InMemoryQueryBus, QueryRegistry } from "@schorts/shared-kernel/cqrs";
import { InMemoryDeadLetterStore, InMemoryEventBus, InMemoryEventStore } from "@schorts/shared-kernel/event-bus";
import { NullLogger } from "@schorts/shared-kernel/logger";
import type { Logger } from "@schorts/shared-kernel/logger";
import type { Mailer } from "@schorts/shared-kernel/mail";
import { NodeExecutionContext } from "@schorts/shared-kernel/node";
import { GetOrder } from "../application/get-order.js";
import type { OrderView } from "../application/get-order.js";
import { GetOrderHandler } from "../application/get-order-handler.js";
import { InvalidateOrderCache } from "../application/invalidate-order-cache.js";
import { PlaceOrder } from "../application/place-order.js";
import { PlaceOrderHandler } from "../application/place-order-handler.js";
import type { ProcessedEvents } from "../application/send-order-confirmation.js";
import { subscribeOrderSubscribers } from "../bootstrap/order-subscribers.js";
import { registerOrderEvents } from "../bootstrap/register-order-events.js";
import type { OrderRepository } from "../domain/order-repository.js";

export type ContainerDeps = {
  orders: OrderRepository;
  mailer: Mailer;
  processedEvents: ProcessedEvents;
  lookupEmail: (customerId: string) => Promise<string>;
  logger?: Logger;
};

export function createContainer(deps: ContainerDeps) {
  // 1. Infrastructure
  const logger = deps.logger ?? new NullLogger();
  const executionContext = new NodeExecutionContext();
  const deadLetters = new InMemoryDeadLetterStore();

  // 2. Buses
  const eventBus = new InMemoryEventBus(new InMemoryEventStore(), { maxRetries: 2 }, deadLetters, logger, executionContext);
  const commandBus = new InMemoryCommandBus({ eventBus, logger, executionContext });
  commandBus.setConfig({ autoPublishEvents: true, maxConcurrency: 50, timeout: 10_000 });
  const queryBus = new InMemoryQueryBus({ logger, executionContext });
  queryBus.setConfig({ enableCaching: true, cacheTtl: 60_000 });

  // 3. Registries
  CommandRegistry.register(PlaceOrder.TYPE, PlaceOrder);
  QueryRegistry.register(GetOrder.TYPE, GetOrder);
  registerOrderEvents();

  // 4. Handlers
  commandBus.register(PlaceOrder.TYPE, new PlaceOrderHandler(deps.orders));
  queryBus.register<GetOrder, OrderView | null>(GetOrder.TYPE, new GetOrderHandler(deps.orders), {
    getKey: query => query.getPayload().orderId,
    getTags: query => [`order:${query.getPayload().orderId}`],
  });

  // 5. Subscribers (and sagas, via SagaManager, once their commands have handlers)
  subscribeOrderSubscribers(eventBus, { mailer: deps.mailer, processed: deps.processedEvents, lookupEmail: deps.lookupEmail });
  const invalidateCache = new InvalidateOrderCache(queryBus);
  for (const eventName of invalidateCache.subscribedTo()) eventBus.subscribe(eventName, invalidateCache);

  return {
    commandBus,
    queryBus,
    eventBus,
    deadLetters,
    async shutdown(): Promise<void> {
      await commandBus.close();
      await queryBus.close();
      await eventBus.close();
    },
  };
}

export type Container = ReturnType<typeof createContainer>;
```

Swap the in-memory pieces for durable ones in production: an `EventStore` and `DeadLetterStore` on your database, repositories and DAOs on your database, and a `SagaStateStore` if you use sagas. Keep `InMemoryCommandBus`/`InMemoryQueryBus`/`InMemoryEventBus` for in-process dispatch; they are not test-only.

## Use it from the edges

Controllers, jobs, and CLI commands receive the container (or just the buses) and only dispatch messages:

```ts
// file: main/server.ts
import { createContainer } from "./container.js";
import type { ContainerDeps } from "./container.js";

export async function start(deps: ContainerDeps, listen: (container: ReturnType<typeof createContainer>) => Promise<() => Promise<void>>) {
  const container = createContainer(deps);
  const stopListening = await listen(container);

  const stop = async () => {
    await stopListening();
    await container.shutdown();
  };
  process.once("SIGTERM", () => void stop());
  return stop;
}
```

## Test the wiring

One test through the container catches missing registrations and wrong order:

```ts
// file: main/container.test.ts
import { InMemoryMailer } from "@schorts/shared-kernel/mail";
import { GetOrder } from "../application/get-order.js";
import type { OrderView } from "../application/get-order.js";
import { PlaceOrder } from "../application/place-order.js";
import { InMemoryOrderRepository } from "../infrastructure/in-memory-order-repository.js";
import { InMemoryProcessedEvents } from "../infrastructure/in-memory-processed-events.js";
import { createContainer } from "./container.js";

const orderId = "0b8b1a3e-6a8f-4a5e-9c55-3f1f1e6b2a10";

describe("container", () => {
  it("places an order, serves it, and emails the customer", async () => {
    const mailer = new InMemoryMailer();
    const container = createContainer({
      orders: new InMemoryOrderRepository(),
      mailer,
      processedEvents: new InMemoryProcessedEvents(),
      lookupEmail: async () => "ada@example.com",
    });

    await container.commandBus.dispatch(
      new PlaceOrder("corr-1", { orderId, customerId: "c-1", lines: [{ sku: "A", quantity: 1, unitPrice: 12 }] }),
    );
    const view = await container.queryBus.dispatch<GetOrder, OrderView | null>(new GetOrder("corr-2", { orderId }));

    expect(view).toMatchObject({ id: orderId, total: 12, status: "placed" });
    expect(mailer.getSentTo("ada@example.com")).toHaveLength(1);
    expect(await container.deadLetters.all()).toEqual([]);
    await container.shutdown();
  });
});
```

## Checklist

- [ ] One composition root; buses created once and shared.
- [ ] Same `logger` and `executionContext` passed to every bus (Node only for `NodeExecutionContext`).
- [ ] Registries filled before handlers; handlers before subscribers and sagas.
- [ ] Bus features enabled with `setConfig` (`autoPublishEvents`, `enableCaching`, limits).
- [ ] `shutdown()` closes the buses in reverse order.
- [ ] A wiring test dispatches through the container.
