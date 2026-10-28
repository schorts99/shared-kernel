# Domain modeling rules

Applies to `value-objects`, `entities`, `aggregates`, `domain-events`, and `models`.

## Value objects

- Subclass a library value object and set `attributeName` (the field name used in error reports). The library classes are abstract.
- Construction never throws. Check `isValid`; collect the invalid ones and throw `ValuesNotValid` (from `value-objects`) yourself, usually in a factory.
- Compare with `equals`, never `===`. Two invalid value objects are never equal.
- Values are immutable. Return a new instance instead of mutating `value`.
- Rebuild from stored data with the static `fromPrimitives` on your subclass; serialize with `toPrimitives()` (`toJSON()` makes `JSON.stringify` work).
- Pick the closest base: `UUIDValue`, `StringValue` (min/max length, optional), `EmailValue`, `PhoneValue`, `SlugValue`, `URLValue`, `PathValue`, `IntegerValue`/`FloatValue` (bounds, decimals), `BooleanValue`, `DateValue` (before/after bounds), `EnumValue`, `CoordinatesValue`, `ObjectValue`/`ArrayValue` (schema-validated), `HTMLValue`, `MarkdownValue`. Extend `BaseValueObject<T>` only for something genuinely new.

```ts
import { EmailValue, StringValue, UUIDValue, ValuesNotValid } from "@schorts/shared-kernel/value-objects";

export class CustomerId extends UUIDValue {
  readonly attributeName = "customerId";
}

export class CustomerName extends StringValue {
  readonly attributeName = "name";

  constructor(value: string) {
    super(value, 1, 120);
  }
}

export class CustomerEmail extends EmailValue {
  readonly attributeName = "email";
}

export function parseCustomer(input: { id: string; name: string; email: string }) {
  const values = {
    id: new CustomerId(input.id),
    name: new CustomerName(input.name),
    email: new CustomerEmail(input.email),
  };
  const invalid = Object.values(values).filter(value => !value.isValid);

  if (invalid.length > 0) {
    throw new ValuesNotValid(
      invalid.map(value => Object.assign(new Error(`invalid ${value.attributeName}`), { attributeName: value.attributeName })),
    );
  }

  return values;
}
```

## Entities and aggregates

- Use `AggregateRoot<IdValue>` for consistency boundaries that record events and track a `version`; use `Entity<IdValue, Model>` for simpler records. Entities can be stored with a `DAO`; aggregates are stored through a repository interface you define (a DAO only accepts entities).
- Identity is the ID value object: `equals` compares IDs (and class), never other fields.
- Change state only through intention-revealing methods that check invariants, then call `recordDomainEvent(...)`.
- Persist with `toPrimitives()`. Include `version` for aggregates so it survives a round trip.
- To support the static `fromPrimitives`, implement `protected createId(raw)` and `protected restoreFromPrimitives(data)`, and keep the constructor callable as `new X(id)` (plus `version` for aggregates). `createId` runs on the prototype, so it must not read instance fields.
- `pullDomainEvents()` returns and clears the recorded events. Call it once, where the events are handed to a bus or unit of work.
- Keep value objects inside the aggregate; expose primitives (or the value objects) through getters. Do not expose mutable internals.

## Domain events

- Subclass `DomainEvent<Payload>` and implement `getEventName()`; add a `static readonly NAME` for subscriptions.
- The constructor is `(correlationId, payload, customMetadata?)`. Keep that signature: buses and stores rebuild events from primitives.
- Payloads are plain, serializable data in past tense (`OrderPlaced`, not `PlaceOrder`). Put IDs and the facts subscribers need; do not put value objects or entities in a payload.
- Register every event with `DomainEventRegistry.register(Event.NAME, Event)` at startup if it is stored, replayed, or recovered after a crash.
- Read the payload with `event.getPayload()`; `id`, `occurredAt`, `correlationId`, `userId`, and `tenantId` come from metadata.
- Pass the triggering command's `correlationId` so a whole flow can be traced.

## Models

- `Model<T, ID>` is the persisted shape: `{ id } & T`. `AuditableModel` adds `createdAt`/`updatedAt`, `FullModel` adds `deletedAt`.
- Models are plain data. Converting between model and entity happens in `toPrimitives`/`fromPrimitives`, not in DAOs.

See [skills/create-value-object](../skills/create-value-object/SKILL.md) and [skills/create-aggregate](../skills/create-aggregate/SKILL.md).
