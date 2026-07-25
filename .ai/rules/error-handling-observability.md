# 🩺 Rule: Error Handling, Observability & Resilience Standards

This rule specifies standards for functional error handling using `Result<T, E>`, structured logging, error tracking, and offline durability stores.

---

## 1. Result Monad (`src/result`)

Use `Result<T, E>` to handle domain operations that may fail predictably without throwing unhandled exceptions.

### Standards:
1. **Instantiation**:
   - `Result.success<T, E>(value)`: Creates a successful result holding `value`.
   - `Result.failure<T, E>(error)`: Creates a failed result holding `error`.
   - `Result.combine<T, E>(results)`: Combines an array of `Result` objects into a single `Result<T[], E>`. Fails early on the first encountered error.
2. **Access & Guards**:
   - Guard check: Always test `.isSuccess()` or `.isFailure()` before accessing `.value` or `.error`.
   - Safe accessors: `.getValue()` and `.getError()` return `T | undefined` and `E | undefined`.
3. **Monadic Chaining**:
   - Use `.map(fn)` to transform successful values.
   - Use `.flatMap(fn)` to chain operations that return another `Result`.
   - Use `.mapError(fn)` to transform error types.
   - Use `.getOrElse(defaultValue)` to safely extract values with a fallback.
   - Use `.match(onSuccess, onFailure)` for pattern matching on outcome.

---

## 2. Observability & Logging (`src/logger`, `src/error-tracking`)

Structured logging and telemetry coordination.

### Standards:
1. **Logger Interface**:
   - Standard logging methods: `log`, `info`, `debug`, `warn`, `error`.
   - Contextual data: Accepts structured `context` object parameter.
2. **ScopedLogger**:
   - Allows scoping logger instances with a fixed context or prefix using `.child(scopeContext)`.
3. **ErrorTracker**:
   - Coordinator class for tracking, filtering, and uploading uncaught or managed errors.
   - `ErrorStore`: Interface for persisting local error history.
   - `ErrorUploader`: Interface for sending error payloads (`TrackedError`) to external telemetry systems (e.g. Sentry, Datadog).
   - Ignore Rules: Configurable predicate list to suppress noise or expected errors.

---

## 3. Offline Durability Store (`src/offline`)

Resilience for queuing commands and operations when network connections are unavailable.

### Standards:
1. **OfflineStore Contract**:
   - Queue commands or service invocation payloads (`OfflinePayload`).
   - Methods: `enqueue(payload)`, `list()`, `dequeue(id)`, `clear()`.
2. **OfflinePayload Payload Structure**:
   - Must encapsulate `{ type: string, args: any[], meta: { userId, tenantId, timestamp, retries, correlationId, origin, version } }`.
