# ⚙️ Rule: CQRS & Event Sourcing Standards

This rule governs the Command Query Responsibility Segregation (CQRS), Event Bus, and Saga orchestration patterns within `@schorts/shared-kernel`.

---

## 1. CQRS (Commands & Queries) (`src/cqrs`)

Separation of side-effect operations (Commands) from read operations (Queries).

### Command Standards:
1. **Command Class**: Extend `Command` or implement `ICommand`.
   - Commands encapsulate user/system intent and required payload state.
   - Must contain metadata (`correlationId`, `userId`, `tenantId`, `timestamp`).
2. **CommandHandler Class**: Extend `CommandHandler<C extends Command, R = void>`.
   - Execute single-purpose write operations.
   - Return type `R` should ideally be `Result<T, E>` or `void` / primitive identifier.
   - Must handle idempotency where applicable.

### Query Standards:
1. **Query Class**: Extend `Query` or implement `IQuery`.
   - Queries represent read requests without state mutations.
   - Can include `Criteria` or search parameters.
2. **QueryHandler Class**: Extend `QueryHandler<Q extends Query, R>`.
   - Fetch projections or read models directly from Data Access Objects or read stores.
   - Never mutate aggregate state inside a `QueryHandler`.

### Command & Query Buses:
1. **CommandBus Interface & InMemoryCommandBus**:
   - Register handlers via `.register(commandName, handler)`.
   - Dispatch commands via `.dispatch(command)`. Throws `CommandHandlerNotFoundException` if no handler is registered.
2. **QueryBus Interface & InMemoryQueryBus**:
   - Register handlers via `.register(queryName, handler)`.
   - Dispatch queries via `.ask(query)`.

---

## 2. Event Bus & Event Store (`src/event-bus`)

Event dispatching and event sourcing primitives.

### Standards:
1. **EventSubscriber Interface**:
   - Implement `subscribedTo(): string[]` defining listened event names.
   - Implement `on(event: DomainEvent): Promise<void>`.
2. **InMemoryEventBus**:
   - Publishes events synchronously or asynchronously to registered subscribers.
   - Supports retry configurations (`maxRetries`) and requeueing.
   - Dead letter routing: Unhandled or persistently failing events after retries MUST be routed to `DeadLetterStore`.
3. **InMemoryEventStore**:
   - Appends events per aggregate ID (`append(aggregateId, events)`).
   - Retrieves event stream for aggregate hydration (`getEventsForAggregate(aggregateId)`).

---

## 3. Sagas (`src/sagas`)

Orchestrate complex distributed workflows spanning multiple aggregates or services.

### Standards:
1. **Saga Class**: Extend `Saga<State>`.
   - State machine holding multi-step progress and transaction status.
   - Define step handlers and compensation handlers for rollbacks upon step failure.
2. **SagaManager**:
   - Dispatches step events and invokes appropriate compensation logic if a step fails.
3. **SagaStateStore**:
   - Persists ongoing saga state by `sagaId` to enable resumption after application restarts.
