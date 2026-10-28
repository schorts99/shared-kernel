# Event and saga rules

Applies to `event-bus`, `sagas`, and `pub-sub`.

## Event bus

- Publish domain events through the command bus (`context.events` + `autoPublishEvents`) or a unit of work with an outbox, so they go out only after the state change commits. Call `eventBus.publish` directly only for events with no transaction behind them.
- Subscribe with `eventBus.subscribe(Event.NAME, subscriber)`. A subscriber that lists several events in `subscribedTo()` still has to be subscribed to each.
- `getName()` identifies a subscriber for retries and dead letters; it must be unique per event and stable across deploys.
- Subscribers receive their own copy of the event. Mutating it does not affect other subscribers.
- `InMemoryEventBus(store, config, deadLetterStore, logger, executionContext)`: failed deliveries go to the dead-letter store after `maxRetries`. Inspect `deadLetterStore.all()` in operations tooling.
- With `autoReplay: true`, call `await eventBus.ready()` after registering subscribers; stored events are replayed then.

## Subscribers

- Extend `AbstractEventSubscriber<Event>` and implement `handle(event)` and `subscribedTo()`. Configure delivery with `super({ retryOnError, maxRetries, priority })`.
- Make handlers idempotent: the same event can be delivered more than once (retries, replays, outbox recovery). Use `event.id` to deduplicate side effects.
- Do not throw for business outcomes; throw only when the delivery should be retried or dead-lettered.
- To change state, dispatch a command from the subscriber instead of writing to a DAO directly.

## Sagas

- Use a saga when one business process spans several commands that must be compensated if a later step fails.
- Extend `Saga<State>` and implement `getInitialState()`, `getSagaId(event)` (the correlation key, usually an aggregate ID from the payload), and `configure()`.
- In `configure()`, map events to steps with `this.on(Event.NAME, async (event, ctx) => { ... })`. Inside a step use `ctx.dispatch(command)`, `ctx.updateState(next)`, `ctx.completeStep(stepId, compensate?)`, and `ctx.completeSaga()`.
- `configure()` runs inside the `Saga` constructor, before the subclass's own fields exist. Do not read `this.someField` in `configure()`; read dependencies inside step callbacks instead.
- Throw from a step to fail the saga: every completed step is compensated in reverse order and the saga is marked `failed`.
- Give every saga `getOptions() { return { retryOnError: false }; }`. Without it the event bus retries a failed delivery (three times by default), and each retry re-runs the step after its compensation already ran.
- Register compensation declaratively with `this.registerStepCompensation(stepId, ctx => ...)` in `configure()`, then mark the step done with `ctx.completeStep(stepId)`. Declarative compensation is found by step ID, so it still runs after a restart. A closure passed as `ctx.completeStep(stepId, async () => ...)` lives only in memory and is lost on restart.
- `getSagaId(event)` receives a plain `DomainEvent`, so its payload is `unknown`; read the ID with a type guard, or use `event.correlationId` when every event in the flow shares it.
- Events for the same saga ID run one at a time; different saga IDs run concurrently. A completed saga ignores further events.
- Register sagas with `new SagaManager(eventBus).register(saga)`; it subscribes the saga to everything `subscribedTo()` returns.
- Saga state must be plain serializable data; provide a durable `SagaStateStore` in production.

## Pub/sub

- `pub-sub` (`InMemoryPubSub`) is for in-process notifications on named channels (UI updates, cache busting), not for domain events. Payloads are typed `unknown` by default; pass a type argument to `subscribe<T>`.

See [skills/add-event-subscriber](../skills/add-event-subscriber/SKILL.md) and [skills/add-saga](../skills/add-saga/SKILL.md).
