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

### 📊 Criteria

- **Criteria:** Fluent query builder for filtering, sorting, and pagination.

### 📣 Domain Events

- **DomainEvent:** Base class for domain-driven event dispatching.

### 🧬 Entities

- **Entity:** Base class for identity-based domain entities.
- **EntityRegistry:** Dynamic registry for entity constructors, enabling polymorphic and type-safe instantiation of domain entities from serialized data.

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