---
name: add-saga
description: Coordinate a multi-step business process with @schorts/shared-kernel — a Saga that reacts to events, dispatches commands, records steps with durable compensation, handles business failures explicitly, compensates automatically when a step throws, and is registered through SagaManager. Use for checkout, booking, onboarding, or any flow spanning several commands.
---

<!-- check-uses: ../create-aggregate/SKILL.md -->

# Add a saga

A saga follows a process across several events and commands, and undoes completed steps when the process cannot finish. This skill builds checkout: when an order is placed, reserve stock and charge payment; ship on success; release stock on failure.

## 1. The messages

Commands and events the saga uses (`OrderPlaced` comes from [create-aggregate](../create-aggregate/SKILL.md)). A small base class keeps the commands short.

```ts
// file: checkout/messages.ts
import { AbstractCommand } from "@schorts/shared-kernel/cqrs";
import { DomainEvent } from "@schorts/shared-kernel/domain-events";

type OrderRef = { orderId: string };

export abstract class OrderCommand extends AbstractCommand<OrderRef> {}

export class ReserveStock extends OrderCommand {
  static readonly TYPE = "inventory.reserve_stock";
  getType(): string {
    return ReserveStock.TYPE;
  }
}

export class ReleaseStock extends OrderCommand {
  static readonly TYPE = "inventory.release_stock";
  getType(): string {
    return ReleaseStock.TYPE;
  }
}

export class ChargePayment extends OrderCommand {
  static readonly TYPE = "payments.charge";
  getType(): string {
    return ChargePayment.TYPE;
  }
}

export class ShipOrder extends OrderCommand {
  static readonly TYPE = "shipping.ship_order";
  getType(): string {
    return ShipOrder.TYPE;
  }
}

export class PaymentCaptured extends DomainEvent<OrderRef> {
  static readonly NAME = "payments.payment_captured";
  getEventName(): string {
    return PaymentCaptured.NAME;
  }
}

export class PaymentFailed extends DomainEvent<OrderRef & { reason: string }> {
  static readonly NAME = "payments.payment_failed";
  getEventName(): string {
    return PaymentFailed.NAME;
  }
}
```

## 2. The saga

- `getSagaId` picks the instance an event belongs to. It receives a plain `DomainEvent`, so read the payload through a type guard.
- `configure()` maps events to steps. It runs inside the base constructor, before your subclass's own fields exist, so use only `ctx` inside steps.
- Register compensation with `registerStepCompensation` and mark the step with `ctx.completeStep(stepId)`. If any later step throws, completed steps are compensated in reverse order and the saga is marked `failed`. Declarative compensation survives restarts; a closure passed to `completeStep` does not.
- Handle expected business failures explicitly (dispatch the undo commands and complete the saga) instead of throwing.
- A failed saga is finished: later events for the same saga ID are ignored, and the event bus does not retry sagas. Retry transient work inside the step (for example with `retry` from `utils`) before letting it throw. To run a failed saga again, delete its state with `stateStore.delete(sagaId)`.

```ts
// file: checkout/checkout-saga.ts
import { Saga } from "@schorts/shared-kernel/sagas";
import type { DomainEvent } from "@schorts/shared-kernel/domain-events";
import { OrderPlaced } from "../domain/order-events.js";
import { ChargePayment, PaymentCaptured, PaymentFailed, ReleaseStock, ReserveStock, ShipOrder } from "./messages.js";

export type CheckoutState = {
  orderId: string | null;
  stage: "started" | "awaiting-payment" | "shipped" | "payment-failed";
};

function orderIdOf(event: DomainEvent): string {
  const payload = event.getPayload();
  if (typeof payload === "object" && payload !== null && "orderId" in payload && typeof payload.orderId === "string") {
    return payload.orderId;
  }
  throw new Error(`Event ${event.getEventName()} has no orderId`);
}

export class CheckoutSaga extends Saga<CheckoutState> {
  protected getInitialState(): CheckoutState {
    return { orderId: null, stage: "started" };
  }

  protected getSagaId(event: DomainEvent): string {
    return `checkout:${orderIdOf(event)}`;
  }

  protected configure(): void {
    this.registerStepCompensation("reserve-stock", async ctx => {
      await ctx.dispatch(new ReleaseStock(ctx.event.correlationId, { orderId: orderIdOf(ctx.event) }));
    });

    this.on<OrderPlaced>(OrderPlaced.NAME, async (event, ctx) => {
      const { orderId } = event.getPayload();
      await ctx.dispatch(new ReserveStock(event.correlationId, { orderId }));
      ctx.completeStep("reserve-stock");

      // If this throws, "reserve-stock" is compensated automatically.
      await ctx.dispatch(new ChargePayment(event.correlationId, { orderId }));
      ctx.updateState({ orderId, stage: "awaiting-payment" });
    });

    this.on<PaymentCaptured>(PaymentCaptured.NAME, async (event, ctx) => {
      await ctx.dispatch(new ShipOrder(event.correlationId, { orderId: event.getPayload().orderId }));
      ctx.updateState({ ...ctx.state, stage: "shipped" });
      ctx.completeSaga();
    });

    this.on<PaymentFailed>(PaymentFailed.NAME, async (event, ctx) => {
      await ctx.dispatch(new ReleaseStock(event.correlationId, { orderId: event.getPayload().orderId }));
      ctx.updateState({ ...ctx.state, stage: "payment-failed" });
      ctx.completeSaga();
    });
  }
}
```

## 3. Register it

`SagaManager` subscribes the saga to every event it handles. Use a durable `SagaStateStore` in production; `InMemorySagaStateStore` is for tests and single-process apps.

```ts
// file: bootstrap/checkout.ts
import type { CommandBus } from "@schorts/shared-kernel/cqrs";
import type { EventBus } from "@schorts/shared-kernel/event-bus";
import { InMemorySagaStateStore, SagaManager } from "@schorts/shared-kernel/sagas";
import type { SagaStateStore } from "@schorts/shared-kernel/sagas";
import { CheckoutSaga } from "../checkout/checkout-saga.js";
import type { CheckoutState } from "../checkout/checkout-saga.js";

export function registerCheckout(
  eventBus: EventBus,
  commandBus: CommandBus,
  stateStore: SagaStateStore<CheckoutState> = new InMemorySagaStateStore<CheckoutState>(),
) {
  const saga = new CheckoutSaga(commandBus, stateStore);
  new SagaManager(eventBus).register(saga);
  return { saga, stateStore };
}
```

## 4. Test it

Use recording command handlers to see what the saga dispatched:

```ts
// file: checkout/checkout-saga.test.ts
import { InMemoryCommandBus } from "@schorts/shared-kernel/cqrs";
import type { Command } from "@schorts/shared-kernel/cqrs";
import { InMemoryEventBus, InMemoryEventStore } from "@schorts/shared-kernel/event-bus";
import { InMemorySagaStateStore } from "@schorts/shared-kernel/sagas";
import { OrderPlaced } from "../domain/order-events.js";
import { registerCheckout } from "../bootstrap/checkout.js";
import type { CheckoutState } from "./checkout-saga.js";
import { ChargePayment, PaymentCaptured, PaymentFailed, ReleaseStock, ReserveStock, ShipOrder } from "./messages.js";

function setup(options: { failCharge?: boolean } = {}) {
  const dispatched: string[] = [];
  const commandBus = new InMemoryCommandBus();
  for (const type of [ReserveStock.TYPE, ReleaseStock.TYPE, ChargePayment.TYPE, ShipOrder.TYPE]) {
    commandBus.register(type, {
      handle: async (command: Command) => {
        if (options.failCharge && type === ChargePayment.TYPE) throw new Error("payment provider down");
        dispatched.push(command.getType());
      },
    });
  }
  const eventBus = new InMemoryEventBus(new InMemoryEventStore());
  const stateStore = new InMemorySagaStateStore<CheckoutState>();
  registerCheckout(eventBus, commandBus, stateStore);
  return { eventBus, stateStore, dispatched };
}

const placed = new OrderPlaced("corr-1", { orderId: "o-1", customerId: "c-1", total: 30 });

describe("CheckoutSaga", () => {
  it("reserves, charges, and ships", async () => {
    const { eventBus, stateStore, dispatched } = setup();

    await eventBus.publish(placed);
    await eventBus.publish(new PaymentCaptured("corr-1", { orderId: "o-1" }));

    expect(dispatched).toEqual([ReserveStock.TYPE, ChargePayment.TYPE, ShipOrder.TYPE]);
    expect(await stateStore.load("checkout:o-1")).toMatchObject({ status: "completed", data: { stage: "shipped" } });
  });

  it("releases stock when payment is declined", async () => {
    const { eventBus, stateStore, dispatched } = setup();

    await eventBus.publish(placed);
    await eventBus.publish(new PaymentFailed("corr-1", { orderId: "o-1", reason: "card declined" }));

    expect(dispatched).toEqual([ReserveStock.TYPE, ChargePayment.TYPE, ReleaseStock.TYPE]);
    expect(await stateStore.load("checkout:o-1")).toMatchObject({ status: "completed", data: { stage: "payment-failed" } });
  });

  it("compensates the reservation when charging throws", async () => {
    const { eventBus, stateStore, dispatched } = setup({ failCharge: true });

    await expect(eventBus.publish(placed)).rejects.toThrow("payment provider down");

    expect(dispatched).toEqual([ReserveStock.TYPE, ReleaseStock.TYPE]);
    expect((await stateStore.load("checkout:o-1"))?.status).toBe("failed");
  });
});
```

## Checklist

- [ ] `getSagaId` derives the instance from the payload through a type guard (or uses `correlationId`).
- [ ] `configure()` uses only `this.on`, `this.registerStepCompensation`, and `ctx` (no subclass fields).
- [ ] Each step that needs undoing has a declarative compensation and calls `ctx.completeStep`.
- [ ] Business failures handled explicitly; unexpected failures throw and compensate.
- [ ] Transient failures retried inside the step, not by the event bus.
- [ ] Registered through `SagaManager`; durable `SagaStateStore` in production.
- [ ] Tests cover success, business failure, and a throwing step.
