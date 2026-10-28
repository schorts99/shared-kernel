# Persistence rules

Applies to `criteria`, `dao`, `unit-of-work`, and `models`.

## Criteria

- Build queries with `Criteria.none()` and chain `where`, `orderBy`, `limitResults`, `offsetResults`. Each call returns a new `Criteria`; the original is unchanged.
- `where(field, operator, value)` checks `value` against the operator:

| Operator | Value |
| --- | --- |
| `EQUAL`, `NOT_EQUAL`, `ARRAY_CONTAINS` | any value |
| `GREATER_THAN`, `LESS_THAN`, `GREATER_THAN_OR_EQUAL`, `LESS_THAN_OR_EQUAL` | number, string, boolean, bigint, or `Date` (ISO strings compare as dates) |
| `IN`, `NOT_IN`, `ARRAY_CONTAINS_ANY` | array |
| `LIKE` | string; `%` matches any run of characters, `_` one character, no wildcard means "contains" (case-insensitive) |
| `BETWEEN` | `[min, max]`, `{ min, max }`, or `{ from, to }` (inclusive) |
| `GEO_RADIUS` | a center (`{ center: [lat, lng] }` or inline `lat`/`lng`) plus `radiusInM`, `radius`, `radiusMeters`, or `radiusInKm` |

- Fields are model (primitive) field names; nested fields use dots (`"address.city"`).
- `limitResults` needs a positive integer and `offsetResults` a non-negative one, otherwise `LimitNotValid` / `OffsetNotValid`.
- Serialize criteria with `toPrimitives()`/`Criteria.fromPrimitives()`, or to and from URLs with `URLCriteriaBuilder`/`URLCriteriaParser` (see the JSON:API rules).

```ts
import { Criteria } from "@schorts/shared-kernel/criteria";

const recentLargeOrders = Criteria.none()
  .where("status", "IN", ["paid", "shipped"])
  .where("total", "GREATER_THAN_OR_EQUAL", 100)
  .where("placedAt", "BETWEEN", { from: new Date("2026-01-01"), to: new Date("2026-02-01") })
  .orderBy("placedAt", "DESC")
  .limitResults(20)
  .offsetResults(0);
```

## DAOs

- A DAO stores `Entity` subclasses: it takes and returns entities, and converts with `toPrimitives()`/`fromPrimitives()`. Keep SQL, documents, and HTTP details inside it.
- `AggregateRoot` is not an `Entity`, so a DAO cannot store one. Give each aggregate a small repository interface in the domain (`findById`, `save`) and implement it in infrastructure, storing `toPrimitives()` (including `version`) and rebuilding with `fromPrimitives`.
- Extend `DAO<Model, Entity>` for a real database and implement every abstract method. Use `InMemoryDAO` in tests and prototypes.
- Every method takes an optional `UnitOfWork` as its last argument. Inside a transaction, pass it to every call; reads with it see uncommitted writes from the same transaction.
- `deleteMode` is `"HARD"` (remove) or `"SOFT"` (set `deletedAt`, hide from reads, `restore` brings it back). Choose per DAO in the constructor.
- `save` creates or updates; `create` fails on an existing ID and `update` on a missing one.
- In a custom DAO, translate each `Filter` by switching on `filter.operator`; `filter.value` is then typed for that operator. Use `readBetweenBounds` and `readGeoRadius` (from `criteria`) so you accept the same shapes as `InMemoryDAO`.

## Units of work

- Wrap work that must commit or roll back together in a `UnitOfWorkRunner`: `await runner.run(async uow => { ... })`. Throwing inside rolls back; returning commits.
- Implement `AsyncUnitOfWorkRunner.createUnitOfWork()` for your database. Implement `resolveCommitOutcome` if a commit can fail ambiguously (lost connection after `COMMIT`), so the runner can tell committed from not committed.
- To publish domain events reliably, give the runner `{ eventStore, eventBus }` (the transactional outbox) and register every changed aggregate or entity with `uow.collectEventsFrom(...)` (events recorded before or after the call are both picked up). Events are staged on commit and published after it; a rollback drops them.
- With the command bus, set `transactional: true` and `createUnitOfWork`; the handler receives `context.unitOfWork`.

See [skills/implement-dao](../skills/implement-dao/SKILL.md) and [skills/use-unit-of-work](../skills/use-unit-of-work/SKILL.md).
