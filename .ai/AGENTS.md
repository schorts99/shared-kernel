# 🤖 Shared Kernel — AI Agent Guide & System Context

Welcome to `@schorts/shared-kernel` (v9.22.0). This document serves as the master guide and context specification for AI agents working within this codebase.

---

## 🎯 Project Overview & Core Philosophy

`@schorts/shared-kernel` is a modular, framework-agnostic TypeScript foundation designed around **Domain-Driven Design (DDD)**, **Command Query Responsibility Segregation (CQRS)**, **Hexagonal Architecture**, and **Functional Error Handling**.

### Key Architectural Tenets
1. **Framework Independence**: Zero hard dependencies on web frameworks (Express, React, NestJS, etc.). All core concepts rely on standard JS/TS runtime primitives and web standards (`fetch`, Promises).
2. **Explicit Domain Invariants**: Encapsulate validation and invariants inside Value Objects and Aggregate Roots.
3. **Immutability First**: Value objects and domain payloads are immutable. State transitions emit explicit Domain Events or produce updated immutable representations.
4. **Result Monad over Thrown Exceptions**: Use `Result<T, E>` for domain failures and expected operational errors. Avoid throwing exceptions for predictable domain validation outcomes.
5. **Dual Distribution & Subpath Exports**: The package exports clean ESM (`dist/esm`) and CJS (`dist/cjs`) targets with precise subpath exports configured in `package.json` (e.g. `@schorts/shared-kernel/criteria`, `@schorts/shared-kernel/value-objects`).

---

## 📁 Repository Structure & Domain Sitemap

```
src/
├── abac/                 # Attribute-Based Access Control (Predicates)
├── aggregates/           # DDD Aggregate Roots & Lifecycle
├── auth/                 # Authentication Provider Interfaces
├── cache/                # Caching Abstractions & In-Memory Cache
├── converters/           # Data Conversion Utilities (e.g. RemoteFileToBase64)
├── cqrs/                 # Commands, Queries, Handlers & Buses
├── criteria/             # Fluent Criteria Query Builder (Filters, Orders)
├── dao/                  # Data Access Object Interfaces & In-Memory DAO
├── domain-events/        # Domain Event Base Classes, Metadata & Registry
├── entities/             # Identity-Based Domain Entities & EntityRegistry
├── error-tracking/       # Observability, Error Tracking & Telemetry Store
├── event-bus/            # In-Memory Event Bus, Event Store & Dead Letter Store
├── files/                # File Handlers & Storage Interfaces
├── formatters/           # String Formatters (e.g., Pascal/Camel to Snake)
├── http/                 # Transport Agnostic HTTP Client (FetchHTTPProvider)
├── i18n/                 # Translation Resolver Interfaces
├── idempotency/          # Idempotency Stores & Keys
├── identity-providers/   # Contracts for External Identity Providers (Auth0, Firebase)
├── json-api/             # JSON:API Connectors, Mappers & URL Criteria Parsers
├── logger/               # Structured Logger, Console Logger & Scoped Logger
├── mail/                 # Email Interfaces & Message Payloads
├── models/               # Base Serializable Models
├── offline/              # Offline Command Queuing & Durability Store
├── pub-sub/              # Real-Time Publisher & Subscription Channels
├── rbac/                 # Role-Based Access Control (Policies & Permissions)
├── result/               # Result Monad (Success/Failure Handling)
├── sagas/                # Saga Orchestration, Saga Manager & State Store
├── state-manager/        # Reactive State Management (Session/Local/Memory)
├── tour-guide/           # Guided UI Onboarding Tour Interfaces
├── types/                # Core TypeScript Utility Types
├── unit-of-work/         # Transactional Unit of Work Boundaries
├── utils/                # Standard Utility Helpers (async, assert, object, string, url)
└── value-objects/        # Comprehensive DDD Value Object Primitives
```

---

## 📜 Architectural Rules Sitemap (`.ai/rules/`)

When making modifications or adding new features in specific domains, you **MUST** consult and adhere to the guidelines in `.ai/rules/`:

| Rule Document | Domain / Purpose |
| :--- | :--- |
| [ddd-domain-modeling.md](file:///.ai/rules/ddd-domain-modeling.md) | Domain-Driven Design rules for Aggregates, Entities, Value Objects, and Domain Events. |
| [cqrs-event-sourcing.md](file:///.ai/rules/cqrs-event-sourcing.md) | CQRS Commands/Queries, Handlers, Buses, Event Sourcing, and Saga Orchestration. |
| [security-access-control.md](file:///.ai/rules/security-access-control.md) | ABAC, RBAC, Auth Providers, and Identity Provider Contracts. |
| [persistence-data-access.md](file:///.ai/rules/persistence-data-access.md) | DAO Pattern, Unit of Work, Criteria Query Builder, and Filters. |
| [networking-api-integration.md](file:///.ai/rules/networking-api-integration.md) | HTTP Providers, JSON:API Connectors, Mappers, Pub-Sub, and Mailers. |
| [typescript-code-standards.md](file:///.ai/rules/typescript-code-standards.md) | TypeScript configuration (`nodenext`), subpath exports, naming, and module patterns. |
| [error-handling-observability.md](file:///.ai/rules/error-handling-observability.md) | `Result<T, E>` monad usage, Logging, Error Tracking, and Offline Store. |

---

## 🛠️ Step-by-Step AI Skills (`.ai/skills/`)

Execute common engineering tasks by following the dedicated skill instructions under `.ai/skills/`:

| Skill | Description | Path |
| :--- | :--- | :--- |
| **add-value-object** | Workflow for implementing new domain Value Objects. | [.ai/skills/add-value-object/SKILL.md](file:///.ai/skills/add-value-object/SKILL.md) |
| **add-cqrs-command-query** | Workflow for adding Commands, Queries, and Handlers. | [.ai/skills/add-cqrs-command-query/SKILL.md](file:///.ai/skills/add-cqrs-command-query/SKILL.md) |
| **add-domain-event** | Procedure for defining and registering new Domain Events. | [.ai/skills/add-domain-event/SKILL.md](file:///.ai/skills/add-domain-event/SKILL.md) |
| **add-jsonapi-connector** | Instructions for mapping resources to JSON:API endpoints. | [.ai/skills/add-jsonapi-connector/SKILL.md](file:///.ai/skills/add-jsonapi-connector/SKILL.md) |
| **add-saga-workflow** | Process for creating multi-step Sagas with compensations. | [.ai/skills/add-saga-workflow/SKILL.md](file:///.ai/skills/add-saga-workflow/SKILL.md) |
| **add-abac-rbac-policy** | Guide for defining RBAC policies and ABAC predicates. | [.ai/skills/add-abac-rbac-policy/SKILL.md](file:///.ai/skills/add-abac-rbac-policy/SKILL.md) |
| **build-and-verify-module** | Verification workflow for compilation & exports integrity. | [.ai/skills/build-and-verify-module/SKILL.md](file:///.ai/skills/build-and-verify-module/SKILL.md) |

---

## ⚙️ Development & Build Commands

- **Build ESM & CJS**: `npm run build`
- **Build CJS Only**: `npm run build:cjs`
- **Build ESM Only**: `npm run build:esm`
- **Run Tests**: `npm test`
- **Run Coverage**: `npm run test:coverage`

---

## 🚨 Guidelines for AI Agents

1. **Check Subpath Exports**: Whenever you add a new module or file in `src/<module>/`, ensure it is exported in `src/<module>/index.ts`, `src/index.ts`, and listed under `"exports"` in `package.json`.
2. **Preserve Immature State Safeguards**: Do not break public APIs or change method signatures without updating all invocation sites across the codebase.
3. **No Dynamic Dependencies**: Rely only on standard TypeScript / Node.js primitives unless explicitly agreed upon.
4. **Use Explicit Imports**: Use relative imports within `src/` modules (e.g. `import { ValueObject } from "../value-objects"`).
