---
name: add-domain-event
description: Workflow for defining, registering, and dispatching Domain Events in shared-kernel.
---

# 🛠️ Skill: Add a Domain Event

This skill details how to define a new `DomainEvent`, register it with `DomainEventRegistry`, and publish it via `EventBus`.

---

## Step 1: Define DomainEvent Class

1. Create a file in `src/domain-events/` (e.g. `user-created-domain-event.ts`).
2. Extend `DomainEvent<PayloadType>`.

```typescript
import { DomainEvent } from "./domain-event";

export interface UserCreatedPayload {
  readonly userId: string;
  readonly email: string;
}

export class UserCreatedDomainEvent extends DomainEvent<UserCreatedPayload> {
  static readonly EVENT_NAME = "user.created.v1";

  constructor(
    correlationId: string,
    payload: UserCreatedPayload,
    customMetadata?: any
  ) {
    super(correlationId, payload, customMetadata);
  }

  getEventName(): string {
    return UserCreatedDomainEvent.EVENT_NAME;
  }
}
```

---

## Step 2: Register in DomainEventRegistry

Register event class with `DomainEventRegistry` to enable hydration from message broker payloads:

```typescript
import { DomainEventRegistry } from "./domain-event-registry";
import { UserCreatedDomainEvent } from "./user-created-domain-event";

DomainEventRegistry.register(
  UserCreatedDomainEvent.EVENT_NAME,
  UserCreatedDomainEvent
);
```

---

## Step 3: Record and Dispatch

Record inside an Aggregate Root and publish through `InMemoryEventBus`:

```typescript
// Inside AggregateRoot method:
this.recordDomainEvent(new UserCreatedDomainEvent(correlationId, { userId: this.id.value, email: "user@example.com" }));

// On save / commit:
const events = aggregate.pullDomainEvents();
for (const event of events) {
  await eventBus.publish(event);
}
```

---

## Step 4: Export Module

Update `src/domain-events/index.ts` to export your new event class.
