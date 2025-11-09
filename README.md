# 📦 Shared Kernel

A modular, type-safe foundation for building expressive, maintainable applications. This package provides core abstractions for domain modeling, HTTP integration, authentication, state management, and more — designed to be framework-agnostic and highly extensible.

## 🚀 Installation

```bash
npm install @schorts/shared-kernel --save
```

## 🧱 Modules

### 🔐 Auth

- **AuthProvider:** Abstract interface for authentication strategies.
- **RequireAuthDecorator:** Method-level decorator for enforcing authentication.

### 🛡️ RBAC (Role-Based Access Control)
- **RBACPolicy:** Abstract base class for defining role-based permission logic. Supports wildcard actions (manage) and resources (*), ownership checks, and composable access control strategies.
- **Permission:** Lightweight value object representing an action-resource pair (e.g., read:orders, manage:*).
- **ABAC Integration:** ABAC Integration: Extend RBAC with attribute-based access control via composable predicates. Use canWithAttributes() and canAnyWithAttributes() to enforce dynamic policies based on user and resource attributes (e.g., ownership, organization, status). This enables hybrid access control strategies that combine declarative roles with contextual rules.

### 📊 Criteria

- **Criteria:** Fluent query builder for filtering, sorting, and pagination.

### 📣 Domain Events

- **DomainEvent:** Base class for domain-driven event dispatching.

### 🧬 Entities

- **Entity:** Base class for identity-based domain entities.
- **EntityRegistry:** Dynamic registry for entity constructors, enabling polymorphic and type-safe instantiation of domain entities from serialized data.

### 🔁 Event Bus

- **AsyncInMemoryEventBus:** Lightweight, in-memory event dispatcher with support for retries, acknowledgments, and requeueing. Designed for testing, local development, or as a foundation for more robust event-driven architectures.
- **DomainEventRegistry:** Centralized registry for hydrating polymorphic domain events from serialized primitives.
- **EventSubscriber:** Interface for subscribing to specific event types with clean, type-safe handlers.
- **InMemoryEventStore:** Simple event store for tracking and replaying events, with retry metadata and bounded requeue support.
- **DeadLetterStore / InMemoryDeadLetterStore:** Dedicated store for capturing events that failed after max retries. Provides inspection (all()), clearing, and replay support.

### 🧭 CQRS (Command Query Responsibility Segregation)
- **Command / CommandHandler:** Define write-side operations that encapsulate intent and state changes. Handlers execute domain logic for commands like CreateUserCommand or SendReportCommand.
- **Query / QueryHandler:** Define read-side operations for retrieving data. Handlers encapsulate query logic and return type-safe results.
- **CommandBus / QueryBus:** Abstract dispatchers for routing commands and queries to their respective handlers. Enables decoupled, centralized execution.
- **InMemoryCommandBus / InMemoryQueryBus:** Lightweight in-memory implementations for local development and testing. Supports dynamic registration and type-safe dispatching.

### 📡 Pub-Sub

- **Publisher:** Abstract interface for dispatching real-time events to external transports (e.g., Pusher, Socket.IO). Designed for event delivery, enabling type-safe, decoupled publishing from domain logic.
- **Subscription:** Client-side abstraction for subscribing to real-time channels and binding event handlers. Supports channel access and dynamic event routing.

### 🧹 Formatters

- **PascalCamelToSnake:** Utility for converting PascalCase or camelCase to snake_case.

### 🌐 HTTP

- **HTTPProvider:** Abstract interface for HTTP transport.
- **FetchHTTPProvider:** Concrete implementation using fetch.

### 🌐 Internationalization (i18n)

- **TranslationResolver:** Infrastructure-agnostic interface for resolving localized strings within the domain. Enables domain errors, validations, and events to be presented in different languages without coupling to any specific i18n implementation. Supports injection into domain exceptions, decorators, and services.
Translation keys are centralized in registries for discoverability and tooling, with patterns to extend keys per bounded context.

### 🔗 JSON:API

- **JSONAPIConnector:** Connector for interacting with JSON:API-compliant endpoints.
- **URLCriteriaParser:** Utility for parsing JSON:API-style query parameters (`filter`, `sort`, `page[limit]`, `page[offset]`) into a type-safe `Criteria` object. Supports operators like `eq`, `ne`, `gt`, `lt`, `in`, `between`, and even geospatial filters (`geo_radius`). This enables seamless conversion from URL query strings into expressive domain queries.

### 📬 Mail

- **Mailer:** Abstract interface for sending email messages. Decouples infrastructure from application logic by exposing a simple contract for outbound communication.
- **Mail:** Type-safe structure representing an email payload, including recipients, subject, body, and optional metadata like CC, BCC, and attachments.

### 🧩 Models

- **BaseModel:** Base class for serializable, type-safe models.

### 🎯 Result

- **Result:** Type-safe wrapper for success/failure outcomes. Encapsulates either a value or an error, enforcing disciplined error handling without exceptions. Includes static factories (`success`, `error`), accessors (`getValue`, `getError`), and guards (`isSuccess`, `isFailure`).

### 🛠 Persistence

- **DAO:** Generic interface defining data access operations for domain entities.
- **UnitOfWork:** Interface enabling transactional coordination across multiple persistence operations.

### 🧰 Dependency Injection

- **DependencyRegistry:** A static, type-safe registry for managing application-level dependencies. Inspired by the EntityRegistry pattern, it enables centralized registration and resolution of services, use cases, and state managers without relying on external DI frameworks. Supports both singleton instances and factory-based registrations.

### 🧠 State Manager

- **StateManager:** Abstract reactive state manager with listener support.
- **SessionStorageStateManager:** Concrete implementation using session storage.
- **InMemoryStateManager:** Concrete implementation using in-memory.

### 🧭 Guided Tours

- **TourGuide:** Abstract base class for defining guided UI tours. Accepts a list of TourStep objects and exposes a fluent API for composing onboarding flows. Designed to be extended by concrete implementations (e.g., Driver.js, Intro.js) in frontend environments.

### 📣 Logger

- **Logger:** Abstract base class for structured, context-aware logging across environments. Supports scoped logging via child() method, enabling per-module or per-request diagnostics. Each method (log, info, debug, warn, error) accepts optional context metadata and variadic arguments for flexible message composition.
- **ConsoleLogger:** Concrete implementation with log levels (LOG, INFO, DEBUG, WARN, ERROR) and contextual metadata injection (e.g., timestamps, custom context). Provides consistent filtering and structured output across environments.
- **ScopedLogger:** Internal utility class returned by Logger.child(). Merges base context with per-call context, enabling nested, composable logging scopes.

### 📈 Telemetry

- **Telemetry:** Abstract interface for unified telemetry across frontend and backend environments. Supports initialization, error tracking, custom context attributes, and transaction naming. Enables integration with observability platforms like New Relic via a consistent API.
- **ConsoleTelemetry:** Development-friendly implementation of the `Telemetry` interface that logs errors, context, and transaction names to the console. Useful for local environments, testing, or CI pipelines where external observability is not required.

### 🧪 Value Objects

- **CoordinatesValue**
- **EmailValue**
- **EnumValue**
- **IntegerValue**
- **PhoneValue**
- **SlugValue**
- **StringValue**
- **UUIDValue**
- **BooleanValue**
- **DateValue**
- **ArrayValue**
- **ObjectValue**
- **FloatValue**
- **URLValue**

### 🔄 Converters
- **RemoteFileToBase64:** Utility for converting remote files (via URL) into base64-encoded strings. Accepts a URL and returns a base64 representation using an injected `HTTPProvider`, enabling infrastructure-agnostic file transformation. Useful for image uploads, previews, and binary transport across domains.

Each value object enforces domain constraints and immutability, ensuring correctness at the boundary of your system.

## 🧠 Philosophy

This kernel is built around:

- **Type safety:** Every abstraction is strongly typed and composable.
- **Domain expressiveness:** Value objects, entities, and events encode business logic directly.
- **Extensibility:** Plug in your own HTTP, auth, or state strategies.
- **Framework independence:** Use it with Node.js, frontend apps, or serverless functions.

## 📦 Example Usage

```ts
import { Criteria } from "@schorts/shared-kernel/criteria";
import { FetchHTTPProvider } from "@schorts/shared-kernel/http";
import { JSONAPIConnector } from "@schorts/shared-kernel/json-api";

// Didn't know what url use for the example hehe
const usersURL = new URL("https://github.com/schorts99");

const criteria = new Criteria()
  .where("status", "EQUAL", "active")
  .orderBy("created_at", "DESC")
  .limitResults(10);

const connector = new JSONAPIConnector(new FetchHTTPProvider());

// UserModel is your own Model
const users = await connector.findMany<UserModel>(usersURL, criteria);
```

## 🧪 Testing

Each module is fully covered with unit tests. To run them:

```bash
npm run test
```

## 📜 License

LGPL