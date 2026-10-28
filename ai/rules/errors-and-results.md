# Error and result rules

Applies to `result`, every module's `exceptions`, and `i18n`.

## Result

- Return `Result<T, E>` from operations whose failure is an expected outcome callers must handle (validation, "not found", business rules). Throw for programming errors and infrastructure failures.
- Create with `Result.success(value)`, `Result.failure(error)`, or `Result.error(new Error(...))`. Wrap promise-based code with `await Result.fromPromise(() => call(), mapError?)`.
- Check with `isSuccess()`/`isFailure()`, or use `match`. Reading `.value` on a failure (or `.error` on a success) throws.
- Transform with `map`, `flatMap`, `mapError`, and their `Async` variants; combine several with `Result.combine([...])`.
- Send a `Result` across a boundary with `toPrimitives()` and rebuild it with `Result.fromPrimitives(primitives, { hydrateValue, hydrateError })`. Values and errors with their own `toPrimitives()` are serialized with it.

```ts
import { Result } from "@schorts/shared-kernel/result";

type Discount = { code: string; percent: number };

function applyDiscount(total: number, discount: Discount): Result<number, string> {
  if (discount.percent <= 0 || discount.percent > 50) {
    return Result.failure(`Discount ${discount.code} is not allowed`);
  }
  return Result.success(Math.round(total * (100 - discount.percent)) / 100);
}

const message = applyDiscount(80, { code: "SPRING", percent: 20 }).match(
  total => `New total: ${total}`,
  reason => `Rejected: ${reason}`,
);
```

## Exceptions

- Catch kernel errors by class with `instanceof`, never by message: messages can be translated.
- Domain-level errors to know: `ValuesNotValid` (with `errors[].attributeName`), `CommandValidationError` / `CommandAuthorizationError` / `CommandExecutionError`, `QueryValidationError` / `QueryAuthorizationError`, `NotAuthorized`, `NotAuthenticated`, `HTTPException`, `JSONAPIErrors`, `LimitNotValid` / `OffsetNotValid`, and the `*NotRegistered` errors (configuration mistakes).
- `CommitOutcomeUnknownError` and `CommandPostCommitError` concern transactions: the first means the commit may or may not have happened, the second that it did but publishing afterwards failed. Neither should be retried blindly.
- Errors with extra data expose it as `unknown`: `HTTPException.body`, `details` on coded errors, `context` on command errors. Narrow before use.

```ts
import { HTTPException } from "@schorts/shared-kernel/http";

function retryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof HTTPException) || error.statusCode !== 429) return null;
  const body = error.body as { retryAfter?: unknown } | undefined;
  return typeof body?.retryAfter === "number" ? body.retryAfter : null;
}
```

## `unknown` values

- Values the kernel hands back without a known shape are `unknown`: HTTP error bodies, message and event `context`, primitives `payload`, JSON:API `attributes`/`meta`, identity claims. Narrow them with a type guard, schema validation, or a deliberate cast at the boundary; do not cast to `any`.
- Pass type arguments where the API takes them: `AbstractCommand<Payload>`, `DomainEvent<Payload>`, `http.get<Response>(...)`, `pubSub.subscribe<Message>(...)`.

## Translated messages

- Kernel exceptions accept an optional `TranslationResolver` and resolve keys listed in `SharedKernelTranslationKeys`. Provide translations for those keys to localize them.
- `InMemoryTranslationResolver` takes a key-to-template map; `{param}` placeholders are replaced from the params.
