import {
  AbstractCommand,
  DomainEvent,
  InMemoryCommandBus,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemorySagaStateStore,
  Saga,
  SagaManager,
} from "../../src";
import type { Command } from "../../src";

type Ref = { orderId: string };

class OrderPlaced extends DomainEvent<Ref> {
  static readonly NAME = "test.order_placed";
  getEventName(): string {
    return OrderPlaced.NAME;
  }
}

class PaymentCaptured extends DomainEvent<Ref> {
  static readonly NAME = "test.payment_captured";
  getEventName(): string {
    return PaymentCaptured.NAME;
  }
}

class Reserve extends AbstractCommand<Ref> {
  static readonly TYPE = "test.reserve";
  getType(): string {
    return Reserve.TYPE;
  }
}

class Release extends AbstractCommand<Ref> {
  static readonly TYPE = "test.release";
  getType(): string {
    return Release.TYPE;
  }
}

class Charge extends AbstractCommand<Ref> {
  static readonly TYPE = "test.charge";
  getType(): string {
    return Charge.TYPE;
  }
}

class Ship extends AbstractCommand<Ref> {
  static readonly TYPE = "test.ship";
  getType(): string {
    return Ship.TYPE;
  }
}

const orderIdOf = (event: DomainEvent) => (event.getPayload() as Ref).orderId;

class CheckoutSaga extends Saga<{ stage: string }> {
  protected getInitialState() {
    return { stage: "started" };
  }

  protected getSagaId(event: DomainEvent): string {
    return orderIdOf(event);
  }

  protected configure(): void {
    this.registerStepCompensation("reserve", async ctx => {
      await ctx.dispatch(new Release(ctx.event.correlationId, { orderId: orderIdOf(ctx.event) }));
    });

    this.on<OrderPlaced>(OrderPlaced.NAME, async (event, ctx) => {
      await ctx.dispatch(new Reserve(event.correlationId, event.getPayload()));
      ctx.completeStep("reserve");
      await ctx.dispatch(new Charge(event.correlationId, event.getPayload()));
      ctx.updateState({ stage: "awaiting-payment" });
    });

    this.on<PaymentCaptured>(PaymentCaptured.NAME, async (event, ctx) => {
      await ctx.dispatch(new Ship(event.correlationId, event.getPayload()));
      ctx.completeSaga();
    });
  }
}

function setup(options: { failCharge: () => boolean }) {
  const dispatched: string[] = [];
  const commandBus = new InMemoryCommandBus();
  for (const type of [Reserve.TYPE, Release.TYPE, Charge.TYPE, Ship.TYPE]) {
    commandBus.register(type, {
      handle: async (command: Command) => {
        if (type === Charge.TYPE && options.failCharge()) throw new Error("payment provider down");
        dispatched.push(command.getType());
      },
    });
  }
  // Default event bus config retries failed deliveries; sagas must opt out.
  const eventBus = new InMemoryEventBus(new InMemoryEventStore());
  const stateStore = new InMemorySagaStateStore<{ stage: string }>();
  const saga = new CheckoutSaga(commandBus, stateStore);
  new SagaManager(eventBus).register(saga);
  return { eventBus, stateStore, dispatched, saga };
}

describe("Saga failure handling", () => {
  it("is not retried by the event bus", () => {
    const { saga } = setup({ failCharge: () => false });

    expect(saga.getOptions()).toEqual({ retryOnError: false });
  });

  it("runs a failing step once, compensates once, and surfaces the error", async () => {
    const { eventBus, stateStore, dispatched } = setup({ failCharge: () => true });

    await expect(eventBus.publish(new OrderPlaced("corr-1", { orderId: "o-1" }))).rejects.toThrow("payment provider down");

    expect(dispatched).toEqual([Reserve.TYPE, Release.TYPE]);
    expect(await stateStore.load("o-1")).toMatchObject({ status: "failed", completedSteps: [] });
  });

  it("ignores later events for a failed saga", async () => {
    const { eventBus, stateStore, dispatched } = setup({ failCharge: () => true });
    await expect(eventBus.publish(new OrderPlaced("corr-1", { orderId: "o-1" }))).rejects.toThrow();

    await eventBus.publish(new PaymentCaptured("corr-1", { orderId: "o-1" }));
    await eventBus.publish(new OrderPlaced("corr-1", { orderId: "o-1" }));

    expect(dispatched).toEqual([Reserve.TYPE, Release.TYPE]);
    expect((await stateStore.load("o-1"))?.status).toBe("failed");
  });

  it("starts over when the failed state is deleted", async () => {
    let providerDown = true;
    const { eventBus, stateStore, dispatched } = setup({ failCharge: () => providerDown });
    await expect(eventBus.publish(new OrderPlaced("corr-1", { orderId: "o-1" }))).rejects.toThrow();

    providerDown = false;
    await stateStore.delete("o-1");
    await eventBus.publish(new OrderPlaced("corr-2", { orderId: "o-1" }));
    await eventBus.publish(new PaymentCaptured("corr-2", { orderId: "o-1" }));

    expect(dispatched).toEqual([Reserve.TYPE, Release.TYPE, Reserve.TYPE, Charge.TYPE, Ship.TYPE]);
    expect((await stateStore.load("o-1"))?.status).toBe("completed");
  });

  it("keeps other saga instances running", async () => {
    const { eventBus, dispatched } = setup({ failCharge: () => false });

    await eventBus.publish(new OrderPlaced("corr-1", { orderId: "o-2" }));
    await eventBus.publish(new PaymentCaptured("corr-1", { orderId: "o-2" }));

    expect(dispatched).toEqual([Reserve.TYPE, Charge.TYPE, Ship.TYPE]);
  });
});
