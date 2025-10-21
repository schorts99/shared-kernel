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

### 🧩 Models

- **BaseModel:** Base class for serializable, type-safe models.

### 🎯 Result

- **Result:** Type-safe wrapper for success/failure outcomes. Encapsulates either a value or an error, enforcing disciplined error handling without exceptions. Includes static factories (`success`, `error`), accessors (`getValue`, `getError`), and guards (`isSuccess`, `isFailure`).

### 🛠 Persistence

- **DAO:** Generic interface defining data access operations for domain entities.
- **UnitOfWork:** Interface enabling transactional coordination across multiple persistence operations.

### 🧠 State Manager

- **StateManager:** Abstract reactive state manager with listener support.
- **SessionStorageStateManager:** Concrete implementation using session storage.
- **InMemoryStateManager:** Concrete implementation using in-memory.

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