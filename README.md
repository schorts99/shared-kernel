# 📦 Shared Kernel

A modular, type-safe foundation for building expressive, maintainable applications. This package provides core abstractions for domain modeling, HTTP integration, authentication, state management, and more — designed to be framework-agnostic and highly extensible.

## 🚀 Installation

```bash
npm install @schorts/shared-kernel --save
```

## 🏗️ Architecture & Modules

The Shared Kernel is organized into several domains of functionality, providing robust primitives for your applications.

### 🧬 Core Domain & DDD
Primitives for expressing your business domain cleanly and enforcing invariants.

- **Aggregates:** 
  - `AggregateRoot`: Base class for a cluster of domain objects that can be treated as a single unit. Inherits from `Entity` and provides built-in domain event recording capabilities.
- **Entities:** 
  - `Entity`: Base class for identity-based domain entities.
  - `EntityRegistry`: Dynamic registry for entity constructors, enabling polymorphic instantiation.
- **Value Objects:** A vast collection of primitives that enforce domain constraints and immutability (e.g., `CoordinatesValue`, `EmailValue`, `StringValue`, `UUIDValue`, `URLValue`, `DateValue`, etc.).
- **Domain Events:**
  - `DomainEvent`: Base class for domain-driven event dispatching.
- **Result:**
  - `Result`: Type-safe wrapper for success/failure outcomes. Enforces disciplined error handling without exceptions. Includes accessors (`getValue`, `getError`) and guards.
- **Models:**
  - `BaseModel`: Base class for serializable, type-safe models.

### ⚙️ Command & Event Processing
Abstractions for CQRS, Event Sourcing, and orchestrating complex distributed workflows.

- **CQRS:** 
  - `Command` / `CommandHandler`: Encapsulate intent and state changes.
  - `Query` / `QueryHandler`: Define read-side operations.
  - `CommandBus` / `QueryBus`: Centralized dispatchers (includes `InMemoryCommandBus` and `InMemoryQueryBus`).
- **Sagas:**
  - `Saga`: Abstract base for defining long-running, stateful business processes.
  - `SagaManager`: Orchestrates saga execution and event routing.
  - `SagaStateStore`: Stores the ongoing state of a Saga to resume across restarts.
- **Event Bus:**
  - `EventSubscriber`: Clean, type-safe event handlers.
  - `InMemoryEventBus`: Dispatcher with support for retries and requeueing.
  - `DomainEventRegistry`: Centralized registry for hydrating polymorphic domain events.
  - `InMemoryEventStore`: Tracks and replays events.
  - `DeadLetterStore`: Captures events that failed after maximum retries.

### 🛡️ Security & Access Control
Tools for managing identities and permissions across applications.

- **Auth:**
  - `AuthProvider`: Abstract interface for authentication strategies.
  - `IdentityProvider`: Contract for external identity services (Firebase, Auth0, Cognito).
- **RBAC (Role-Based Access Control):**
  - `RBACPolicy`: Base class for defining role-based permission logic.
  - `Permission`: Lightweight value object for action-resource pairs (e.g., `read:orders`).
- **ABAC (Attribute-Based Access Control):** Extend RBAC with dynamic, contextual attributes using composable predicates.

### 💾 Persistence & Data Access
Interfaces to decouple application logic from database engines.

- **DAO (Data Access Object):** Generic interface defining CRUD operations for entities.
- **UnitOfWork:** Enables transactional coordination across multiple persistence operations.
- **Criteria:** Fluent query builder for filtering, sorting, and pagination.

### 🌐 Networking & APIs
Integrate seamlessly with external services and clients.

- **HTTP:**
  - `HTTPProvider`: Abstract interface for HTTP transport.
  - `FetchHTTPProvider`: Concrete implementation using `fetch`.
- **JSON:API:**
  - `JSONAPIConnector`: Interact with JSON:API-compliant endpoints.
  - `URLCriteriaParser`: Parses JSON:API-style URL parameters into a type-safe `Criteria` object.
  - `EntityJSONAPIMapper`: Converts `Entity` instances into JSON:API-compliant payloads.
- **Pub-Sub:**
  - `Publisher`: Dispatch real-time events to external transports (Pusher, Socket.IO).
  - `Subscription`: Client-side abstraction for subscribing to real-time channels.
- **Mail:**
  - `Mailer`: Interface for sending email messages.
  - `Mail`: Type-safe structure representing an email payload.

### 💻 State & UI
Helpers for building robust frontend experiences.

- **State Manager:**
  - `StateManager`: Abstract reactive state manager with listener support.
  - Includes `SessionStorageStateManager`, `LocalStorageStateManager`, and `InMemoryStateManager`.
- **Guided Tours:**
  - `TourGuide`: Abstract base class for defining UI onboarding tours. Integrates with libraries like Driver.js or Intro.js.
- **i18n (Internationalization):**
  - `TranslationResolver`: Infrastructure-agnostic interface for resolving localized strings within the domain.

### 🩺 Observability & Tracking
Diagnostics, error handling, and structured logging.

- **Logger:**
  - `Logger`: Structured, context-aware logging (`log`, `info`, `debug`, `warn`, `error`).
  - `ConsoleLogger`: Local development implementation.
  - `ScopedLogger`: Composable logging scopes via `.child()`.
- **Error Tracking:**
  - `ErrorTracker`: Coordinator class to track, store, and upload errors robustly with configurable ignore rules.
  - `ErrorStore` & `ErrorUploader`: Interfaces to plug into telemetry systems (Sentry, Datadog).
  - `TrackedError`: Generic model for a tracked error payload.

### 🛠️ Utilities
Essential helper functions and types used across bounded contexts.

- **Types:** Core utility types such as `Constructor`, `DeepPartial`, `Dictionary`, `JSON`, `MaybePromise`, `Nullable`, and `Optional`.
- **Utils:** Common functions for `assertion`, `async` flows, `object` manipulation, `string` handling, and `url` parsing.
- **Formatters:** Utilities like `PascalCamelToSnake` case conversion.
- **Converters:** Utilities like `RemoteFileToBase64`.

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

const usersURL = new URL("https://api.example.com/users");

const criteria = new Criteria()
  .where("status", "EQUAL", "active")
  .orderBy("created_at", "DESC")
  .limitResults(10);

const connector = new JSONAPIConnector(new FetchHTTPProvider());

// UserModel is your own Model class
const users = await connector.findMany<UserModel>(usersURL, criteria);
```

## 🧪 Testing

Each module is fully covered with unit tests using Jest. To run them:

```bash
npm run test
```

## 📜 License

LGPL-3.0-or-later
