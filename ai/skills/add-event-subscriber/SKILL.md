---
name: add-event-subscriber
description: React to a domain event with @schorts/shared-kernel — an AbstractEventSubscriber with retries and a stable name, idempotent side effects keyed on the event ID, subscription on the event bus, dead-letter handling, and a test. Use for side effects such as emails, projections, cache invalidation, or follow-up commands.
---

<!-- check-uses: ../create-aggregate/SKILL.md -->

# Add an event subscriber

Subscribers run side effects after something happened. This skill sends a confirmation email when an `OrderPlaced` event (from [create-aggregate](../create-aggregate/SKILL.md)) is published.

## 1. The subscriber

- Extend `AbstractEventSubscriber<Event>`; implement `subscribedTo()` and `handle(event)`.
- Delivery options go to `super(...)`. Subscribers do not retry unless you pass `retryOnError: true`.
- `getName()` defaults to the class name. It identifies the subscriber for acknowledgements and dead letters, so keep it stable; override it if you minify class names.
- The same event can arrive more than once (retries, replays, outbox recovery). Key side effects on `event.id` so a repeat does nothing.
- To change state, dispatch a command instead of writing to storage directly.

```ts
// file: application/send-order-confirmation.ts
import { AbstractEventSubscriber } from "@schorts/shared-kernel/event-bus";
import type { Mailer } from "@schorts/shared-kernel/mail";
import { OrderPlaced } from "../domain/order-events.js";

export interface ProcessedEvents {
  has(key: string): Promise<boolean>;
  add(key: string): Promise<void>;
}

export class SendOrderConfirmation extends AbstractEventSubscriber<OrderPlaced> {
  constructor(
    private readonly mailer: Mailer,
    private readonly processed: ProcessedEvents,
    private readonly lookupEmail: (customerId: string) => Promise<string>,
  ) {
    super({ retryOnError: true, maxRetries: 2 });
  }

  override getName(): string {
    return "orders.send-order-confirmation";
  }

  subscribedTo(): string[] {
    return [OrderPlaced.NAME];
  }

  async handle(event: OrderPlaced): Promise<void> {
    const key = `${this.getName()}:${event.id}`;
    if (await this.processed.has(key)) return;

    const { orderId, customerId, total } = event.getPayload();
    await this.mailer.send({
      to: await this.lookupEmail(customerId),
      subject: `Order ${orderId} confirmed`,
      text: `Thanks for your order. Total: ${total.toFixed(2)}.`,
    });
    // Record only after the side effect succeeds, so a retry does the work again.
    await this.processed.add(key);
  }
}
```

Record the key only after the side effect succeeds. Recording it first turns a failed attempt into a silent success on retry. In production, back `ProcessedEvents` with a table keyed on the event key. A simple in-memory version for tests:

```ts
// file: infrastructure/in-memory-processed-events.ts
import type { ProcessedEvents } from "../application/send-order-confirmation.js";

export class InMemoryProcessedEvents implements ProcessedEvents {
  private readonly keys = new Set<string>();

  async has(key: string): Promise<boolean> {
    return this.keys.has(key);
  }

  async add(key: string): Promise<void> {
    this.keys.add(key);
  }
}
```

## 2. Subscribe it

Subscribe to every event the subscriber handles. Give the bus a dead-letter store so failures after the last retry are kept for inspection:

```ts
// file: bootstrap/order-subscribers.ts
import type { EventBus } from "@schorts/shared-kernel/event-bus";
import type { Mailer } from "@schorts/shared-kernel/mail";
import { SendOrderConfirmation } from "../application/send-order-confirmation.js";
import type { ProcessedEvents } from "../application/send-order-confirmation.js";

export function subscribeOrderSubscribers(
  eventBus: EventBus,
  deps: { mailer: Mailer; processed: ProcessedEvents; lookupEmail: (customerId: string) => Promise<string> },
): void {
  const subscriber = new SendOrderConfirmation(deps.mailer, deps.processed, deps.lookupEmail);
  for (const eventName of subscriber.subscribedTo()) {
    eventBus.subscribe(eventName, subscriber);
  }
}
```

## 3. Know what a failure does

- A subscriber that still fails after its retries makes `eventBus.publish` reject. When the command bus publishes for you (`autoPublishEvents`), the command has already committed, so the caller gets `CommandPostCommitError`.
- With a dead-letter store, the failed delivery is recorded (`await deadLetterStore.all()`) and not retried again; without one it stays in the event store for `eventBus.replay()`.
- Other subscribers of the same event still run; each gets its own copy of the event.

## 4. Test it

```ts
// file: application/send-order-confirmation.test.ts
import { InMemoryDeadLetterStore, InMemoryEventBus, InMemoryEventStore } from "@schorts/shared-kernel/event-bus";
import { InMemoryMailer } from "@schorts/shared-kernel/mail";
import { OrderPlaced } from "../domain/order-events.js";
import { InMemoryProcessedEvents } from "../infrastructure/in-memory-processed-events.js";
import { subscribeOrderSubscribers } from "../bootstrap/order-subscribers.js";

function setup(lookupEmail: (customerId: string) => Promise<string> = async () => "ada@example.com") {
  const deadLetters = new InMemoryDeadLetterStore();
  const eventBus = new InMemoryEventBus(new InMemoryEventStore(), {}, deadLetters);
  const mailer = new InMemoryMailer();
  subscribeOrderSubscribers(eventBus, { mailer, processed: new InMemoryProcessedEvents(), lookupEmail });
  return { eventBus, mailer, deadLetters };
}

const placed = () => new OrderPlaced("corr-1", { orderId: "o-1", customerId: "c-1", total: 30 }, { id: "evt-1" });

describe("SendOrderConfirmation", () => {
  it("sends one email per event, even when the event is delivered twice", async () => {
    const { eventBus, mailer } = setup();

    await eventBus.publish(placed());
    await eventBus.publish(placed());

    expect(mailer.getSentTo("ada@example.com")).toHaveLength(1);
    expect(mailer.getSentMails()[0]?.subject).toBe("Order o-1 confirmed");
  });

  it("retries, then dead-letters a delivery that keeps failing", async () => {
    let attempts = 0;
    const { eventBus, deadLetters } = setup(async () => {
      attempts++;
      throw new Error("customer service unavailable");
    });

    await expect(eventBus.publish(placed())).rejects.toThrow("customer service unavailable");
    expect(attempts).toBe(3);
    expect((await deadLetters.all()).map(entry => entry.reason)).toEqual(["customer service unavailable"]);
  });
});
```

The failing delivery is attempted three times (the first try plus `maxRetries: 2`) before it is dead-lettered.

## Checklist

- [ ] Extends `AbstractEventSubscriber`, implements `subscribedTo()` and `handle()`.
- [ ] Stable `getName()`.
- [ ] Side effects deduplicated by `event.id`.
- [ ] Subscribed to every event in `subscribedTo()`; the bus has a dead-letter store.
- [ ] Tests cover normal delivery, repeat delivery, and failure.
