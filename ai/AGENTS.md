# Using `@schorts/shared-kernel`

A framework-agnostic TypeScript toolkit for domain-driven design: value objects, entities, aggregates, domain events, CQRS buses, sagas, a criteria/DAO persistence layer, units of work with an outbox, JSON:API and HTTP clients, RBAC/ABAC, and in-memory implementations of every port for tests.

Read this file first. Then read the rule file for the area you are touching, and follow the matching skill when the task is one of those listed below.

## Imports

Import from the module subpath, not deep file paths:

```ts
import { Criteria } from "@schorts/shared-kernel/criteria";
import { AbstractCommand, InMemoryCommandBus } from "@schorts/shared-kernel/cqrs";
import { UUIDValue } from "@schorts/shared-kernel/value-objects";
```

- Everything except the Node-only helpers is also exported from the package root (`@schorts/shared-kernel`). Prefer subpaths; they keep bundles small and intent clear.
- `@schorts/shared-kernel/node` holds Node-only code (`NodeExecutionContext`). Never import it from browser code.
- The package ships both ES modules and CommonJS with matching types. Do not reach into `dist/`.

Subpaths: `abac`, `aggregates`, `auth`, `cache`, `converters`, `cqrs`, `criteria`, `dao`, `domain-events`, `entities`, `error-tracking`, `event-bus`, `files`, `formatters`, `http`, `i18n`, `idempotency`, `identity-providers`, `json-api`, `logger`, `mail`, `models`, `node`, `offline`, `pub-sub`, `rbac`, `result`, `sagas`, `state-manager`, `types`, `unit-of-work`, `utils`, `validators`, `value-objects`.

## Rules that matter most

1. **Value objects never throw.** Construct them, then check `isValid`. Collect invalid ones and throw `ValuesNotValid` yourself. Every concrete value object must set `attributeName`.
2. **Library base classes are abstract.** Subclass `UUIDValue`, `StringValue`, `AbstractCommand`, `DomainEvent`, `AbstractCommandHandler`, and so on; do not instantiate them directly.
3. **Messages travel as primitives.** Buses rebuild commands, queries, and events from `toPrimitives()`/`fromPrimitives()`. Payloads must be plain data (no class instances, functions, or value objects), and subclasses must keep the `(correlationId, payload, customMetadata?)` constructor.
4. **Handlers implement `execute`, buses call `handle`.** Extend `AbstractCommandHandler`/`AbstractQueryHandler` and implement `protected execute`. Throw `CommandValidationError`/`QueryValidationError` from `validate`; any other error from a command handler reaches callers wrapped in `CommandExecutionError`.
5. **Domain events leave a command through `context.events`.** Push `aggregate.pullDomainEvents()` into the handler context; the bus publishes them after the command (and its transaction) succeeds when `autoPublishEvents` is on.
6. **Returned values are `unknown`, not `any`.** HTTP error bodies, metadata `context`, exception `details`, JSON:API `attributes`, and primitives `payload` must be narrowed before use.
7. **`Criteria.where` checks the value against the operator.** `IN` takes an array, `LIKE` a string pattern, `BETWEEN` two bounds, `GEO_RADIUS` a center and radius.
8. **Use the in-memory adapters in tests**, not mocks of the ports.

## Rules by area

| Area | Rule file |
| --- | --- |
| Value objects, entities, aggregates, domain events | [rules/domain-modeling.md](rules/domain-modeling.md) |
| Commands, queries, handlers, buses | [rules/cqrs.md](rules/cqrs.md) |
| Event bus, subscribers, sagas | [rules/events-and-sagas.md](rules/events-and-sagas.md) |
| Criteria, DAOs, units of work, outbox | [rules/persistence.md](rules/persistence.md) |
| `Result`, exceptions, `unknown` values, i18n | [rules/errors-and-results.md](rules/errors-and-results.md) |
| HTTP providers and JSON:API | [rules/http-and-json-api.md](rules/http-and-json-api.md) |
| RBAC and ABAC | [rules/access-control.md](rules/access-control.md) |
| Testing with in-memory adapters | [rules/testing.md](rules/testing.md) |

## Skills

| Task | Skill |
| --- | --- |
| Add a value object | [skills/create-value-object](skills/create-value-object/SKILL.md) |
| Add an aggregate (or entity) that records domain events | [skills/create-aggregate](skills/create-aggregate/SKILL.md) |
| Add a command and its handler | [skills/add-command](skills/add-command/SKILL.md) |
| Add a query and its handler, optionally cached | [skills/add-query](skills/add-query/SKILL.md) |
| React to a domain event | [skills/add-event-subscriber](skills/add-event-subscriber/SKILL.md) |
| Coordinate a multi-step process with compensation | [skills/add-saga](skills/add-saga/SKILL.md) |
| Implement a DAO for a real database | [skills/implement-dao](skills/implement-dao/SKILL.md) |
| Run work in a transaction and publish its events | [skills/use-unit-of-work](skills/use-unit-of-work/SKILL.md) |
| Call a JSON:API backend | [skills/consume-json-api](skills/consume-json-api/SKILL.md) |
| Restrict who can do what | [skills/define-access-policy](skills/define-access-policy/SKILL.md) |
| Wire the kernel into an application | [skills/wire-application](skills/wire-application/SKILL.md) |
| Upgrade from 10.x to 11.x | [skills/migrate-to-v11](skills/migrate-to-v11/SKILL.md) |
