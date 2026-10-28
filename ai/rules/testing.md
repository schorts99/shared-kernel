# Testing rules

- Test against the in-memory implementations of the ports instead of mocking interfaces. They behave like the real thing (cloning, transactions, retries, cycle detection):

| Port | In-memory implementation |
| --- | --- |
| `CommandBus` / `QueryBus` / `EventBus` | `InMemoryCommandBus`, `InMemoryQueryBus`, `InMemoryEventBus` (+ `InMemoryEventStore`, `InMemoryDeadLetterStore`) |
| `DAO` | `InMemoryDAO` |
| `UnitOfWork` / runner | `InMemoryUnitOfWork`, `InMemoryUnitOfWorkRunner` |
| `IdempotencyStore`, `Cache` | `InMemoryIdempotencyStore`, `InMemoryCache` |
| `SagaStateStore` | `InMemorySagaStateStore` |
| `HTTPProvider` | `InMemoryHTTPProvider` (stub routes with `on(method, matcher, response)`, inspect `getRequests()`) |
| `Logger` | `InMemoryLogger` (`getEntries()`, `getByLevel(level)`) |
| `Mailer`, `FileProvider`, `TranslationResolver`, `OfflineStore`, `ErrorStore` | `InMemoryMailer`, `InMemoryFileProvider`, `InMemoryTranslationResolver`, `InMemoryOfflineStore`, `InMemoryErrorStore` |
| Auth / identity | `InMemoryAuthProvider`, `InMemoryIdentityProvider` |

- Build a fresh set of adapters per test so state does not leak between tests.
- Registries (`CommandRegistry`, `QueryRegistry`, `DomainEventRegistry`, `EntityRegistry`) are global. Register in `beforeAll` and `unregister` anything a test adds temporarily.
- Test a command end to end through the bus: dispatch it, then assert on the DAO contents and the published events. Test aggregates directly by calling their methods and reading `pullDomainEvents()`.
- Assert on error classes (`rejects.toBeInstanceOf(CommandValidationError)`), not messages.
- Close buses in `afterEach` (`await bus.close()`) when tests leave work running.
- Value objects: cover valid input, each invalid case, `equals`, and the `fromPrimitives(toPrimitives())` round trip.
- If your tests compile decorators (`@RegisterEntity`), compile them for `ES2022` or lower; Node cannot run decorator syntax yet.

See the testing section of each skill for a worked example.
