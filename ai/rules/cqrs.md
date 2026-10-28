# CQRS rules

Applies to `cqrs`, `idempotency`, and `cache`.

## Messages

- A command asks for a change (`PlaceOrder`); a query asks for data (`GetOrder`). Never change state in a query handler.
- Subclass `AbstractCommand<Payload>` / `AbstractQuery<Payload>` and implement `getType()` returning a stable, namespaced string (`"orders.place"`). Expose it as `static readonly TYPE`.
- Construct as `new PlaceOrder(correlationId, payload, customMetadata?)`. Keep this constructor signature in subclasses; buses rebuild messages through the static `fromPrimitives`.
- Payloads are plain serializable data: strings, numbers, booleans, `null`, arrays, plain objects, `Date`. No value objects, entities, class instances, or functions. Build value objects inside the handler.
- Put who/where in metadata, not the payload: `{ userId, tenantId, headers, context }` in the third constructor argument.
- Register commands with `CommandRegistry.register(Type.TYPE, Type)` (and queries with `QueryRegistry`) at startup when they are persisted, replayed offline, or recovered after a crash.

## Handlers

- Extend `AbstractCommandHandler<Command, Result>` / `AbstractQueryHandler<Query, Result>` and implement `protected async execute(message, context)`. Do not override `handle`: it runs `validate`, `authorize`, idempotency, timeouts, retries, and logging around `execute`.
- Validate input in `validate` and throw `CommandValidationError` / `QueryValidationError`. Check permissions in `authorize` and throw `CommandAuthorizationError` / `QueryAuthorizationError`.
- Any other error thrown by a command handler reaches the caller wrapped in `CommandExecutionError` (original in `context.originalError`). Throw the specific error types when callers need to tell failures apart.
- Pass options through the constructor: `super({ timeout, maxRetries, idempotent, idempotencyStore, cache, logger, logging })`. `maxRetries` retries only errors `canRetry(command, error)` accepts, which by default is only `CommandExecutionError`; override `canRetry` to retry your transient errors. Retries are off when the bus runs the handler in a transaction.
- Hand domain events to the bus with `context.events.push(...aggregate.pullDomainEvents())`. Do not publish from inside the handler.
- Use `context.unitOfWork` when the bus runs transactionally (`transactional: true`); pass it to every DAO call so the work commits or rolls back together.
- Respect `context.signal` in long-running work (pass it to `fetch`, check `signal.throwIfAborted()`).

## Buses

- One bus instance per process, shared by everything. Register each type once: `bus.register(Type.TYPE, handler)`.
- `InMemoryCommandBus` is a real in-process bus, not only a test double. Its dependencies are `{ eventBus, createUnitOfWork, transactionalIdempotency, logger, executionContext }`; enable features with `setConfig({ autoPublishEvents, transactional, maxConcurrency, timeout })`.
- `autoPublishEvents` needs an `eventBus`; `transactional` needs `createUnitOfWork`. Events publish only after the transaction commits.
- In Node, pass `executionContext: new NodeExecutionContext()` (from `@schorts/shared-kernel/node`) to buses and idempotency stores so cross-bus deadlocks are detected instead of hanging.
- Dispatch with `await bus.dispatch(message)`, passing `{ signal }` to cancel. Set time limits with the bus `timeout` config or the handler `timeout` option. Handle `CommandHandlerNotRegistered` / `QueryHandlerNotRegistered` as programming errors.
- Call `await bus.close()` on shutdown to stop accepting work and wait for in-flight work.

## Idempotency and caching

- For commands that must not run twice, pass `{ idempotent: true, idempotencyStore }` to the handler. The default key combines the command's type, `id`, request/user/tenant metadata, and payload, so it deduplicates redelivery of the same command. To deduplicate a client retrying the same request with a new command, override `getIdempotencyKey(command)` to return a client-supplied key (for example `requestId` from metadata).
- A `CommitOutcomeUnknownError` means the database may or may not have committed. Do not retry blindly; resolve it with `idempotencyStore.resolveUnknownCommit(key, outcome)` after checking durable storage.
- Cache query results on the bus: register a policy with `queryBus.register(Type.TYPE, handler, { getKey, ttl, getTags })` and turn caching on with `queryBus.setConfig({ enableCaching: true })` (it is off by default). Invalidate with `await queryBus.invalidateCache(tags)`, typically from a subscriber to the event that changed the data.
- Separately, a command handler given a `cache` option deletes the tags returned by `getInvalidationTags(command, result)` from that cache after it succeeds.
- Cache keys are already scoped by query type, user, tenant, and version; `getKey` only needs the resource identity.

See [skills/add-command](../skills/add-command/SKILL.md) and [skills/add-query](../skills/add-query/SKILL.md).
