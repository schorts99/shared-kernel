---
name: migrate-to-v11
description: Upgrade a project from @schorts/shared-kernel 10.x to 11.x — handler execute changes, unknown instead of any, typed Criteria values, removed tour guide and browser state managers, randomString and Node requirements, and the real ESM build. Use when bumping the package to 11 or fixing type errors after the upgrade.
---

# Migrate from 10.x to 11.x

Work through the steps in order, running your type checker after each. Most changes surface as compile errors; the runtime changes are called out.

## 1. Update and type-check

11.x requires Node.js 20 or later. Upgrade older runtimes first.

```bash
npm install @schorts/shared-kernel@^11
npx tsc --noEmit
```

Group the errors by the sections below.

## 2. Command and query handlers

`execute` is no longer part of the `CommandHandler`/`QueryHandler` interfaces, and it is `protected` on the abstract classes.

- Subclasses of `AbstractCommandHandler`/`AbstractQueryHandler`: no change needed. Prefer declaring `protected async execute(...)`.
- Hand-written handler objects: remove any `execute` you added only to satisfy the interface. Only `handle` is required.
- Calls to `handler.execute(command)`: replace with `bus.dispatch(command)` (or `handler.handle(command)`). Calling `execute` skipped validation, authorization, idempotency, and timeouts.

```ts no-check
// Before
const result = await handler.execute(command);
// After
const result = await commandBus.dispatch(command);
```

## 3. `unknown` instead of `any`

Values the kernel returns without a known shape are now `unknown`. Narrow them where you read them:

| Where | What to do |
| --- | --- |
| `HTTPException.body` | Cast to the error shape you expect, or check fields with `typeof`/`in`. |
| `command.context`, `event.context`, metadata `context` | Check the key you read. |
| Exception `details` / `context` | Same. |
| JSON:API `attributes` in `included`, `meta`, `relationships` | Narrow per field. |
| Identity provider `claims` | Narrow per claim. |
| `toPrimitives().payload` on commands, queries, events | Cast to the payload type. |
| `Result.fromPrimitives` `hydrateValue`/`hydrateError` input | Treat the input as untrusted. |
| `Command`, `Query`, `DomainEvent`, `Publisher`, `MessageHandler`, `Dictionary` without a type argument | Pass the payload type, for example `AbstractCommand<PlacePayload>`. |

```ts
import { HTTPException } from "@schorts/shared-kernel/http";

export function validationMessages(error: unknown): string[] {
  if (!(error instanceof HTTPException)) return [];
  const body = error.body as { errors?: Array<{ detail?: unknown }> } | undefined;
  return (body?.errors ?? []).flatMap(item => (typeof item.detail === "string" ? [item.detail] : []));
}
```

Avoid replacing these with `as any`; that hides the mistakes the change is meant to catch.

## 4. Typed `Criteria` values

`Criteria.where` now checks `value` against the operator. Fix each error by passing the expected shape:

| Error on | Expected value |
| --- | --- |
| `IN`, `NOT_IN`, `ARRAY_CONTAINS_ANY` | an array |
| `LIKE` | a string pattern |
| `GREATER_THAN` and the other range operators | number, string, boolean, bigint, or `Date` |
| `BETWEEN` | `[min, max]`, `{ min, max }`, or `{ from, to }` |
| `GEO_RADIUS` | a center plus `radiusInM`, `radius`, `radiusMeters`, or `radiusInKm` |

These values were already ignored at runtime, so each fix is a bug that was silently returning wrong results.

Custom DAOs that read `filter.value`: switch on `filter.operator` to get a typed value, and use `readBetweenBounds`/`readGeoRadius` from `criteria` (see the implement-dao skill).

Runtime change: `URLCriteriaBuilder` now serializes `GEO_RADIUS` with `radiusInKm` or `lon`, and `BETWEEN` given as `{ min, max }` or `{ from, to }`, which it used to drop. Check that your backend accepts the filters it now receives.

## 5. Removed modules

- `@schorts/shared-kernel/tour-guide` and its root exports (`TourGuide`, `BaseTourGuide`, `TourStep`, …) are gone. Move tour code into your app.
- `LocalStorageStateManager` and `SessionStorageStateManager` are gone. Extend `StateManager` yourself:

```ts
import { StateManager } from "@schorts/shared-kernel/state-manager";

export class LocalStorageStateManager<Schema extends Record<string, unknown>> extends StateManager<Schema> {
  constructor(private readonly storageKey: string, initialState: Schema) {
    const saved = globalThis.localStorage?.getItem(storageKey);
    super(saved ? { ...initialState, ...(JSON.parse(saved) as Partial<Schema>) } : initialState);
  }

  getValue<Key extends keyof Schema>(key: Key): Schema[Key] {
    return structuredClone(this.state[key]);
  }

  setValue<Key extends keyof Schema>(key: Key, value: Schema[Key]): void {
    this.commit({ ...this.state, [key]: structuredClone(value) });
  }

  removeValue<Key extends keyof Schema>(key: Key): void {
    const { [key]: _removed, ...rest } = this.state;
    this.commit(rest as Schema);
  }

  patch(values: Partial<Schema>): void {
    this.commit({ ...this.state, ...structuredClone(values) });
  }

  reset(): void {
    this.commit(structuredClone(this.initialState));
  }

  private commit(next: Schema): void {
    this.state = next;
    globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(next));
    this.notifyListeners();
  }
}
```

## 6. Behavior changes to check

- `randomString` uses `crypto.getRandomValues` and throws if Web Crypto is unavailable. It also rejects negative or non-integer lengths.
- `JSONAPIConnector` converts an error into `JSONAPIErrors` only when the response body has an `errors` array; other error bodies now surface as `HTTPException`.
- ABAC predicates passed inline to `canWithAttributes` and friends now have typed parameters; remove explicit `any` annotations you added to them.
- A saga whose step failed is final: later events for it are ignored, and the event bus no longer retries saga deliveries. If you relied on bus retries for transient failures, retry inside the step instead; delete the saga's state to run it again. If a saga subclass defines its own `getOptions`, mark it `override`.

## 7. Packaging

- The `import` entry points are now real ES modules. If you imported the package from ESM and relied on CommonJS interop (`import pkg from "@schorts/shared-kernel"; pkg.Criteria`), switch to named imports.
- Do not import from `dist/` paths; use the package root or subpaths.
- Bundlers can now tree-shake unused modules (`"sideEffects": false`).

## 8. Finish

```bash
npx tsc --noEmit
npm test
```

Search for leftovers: `as any` added during the upgrade, `.execute(` calls on handlers, and `tour-guide` imports.
