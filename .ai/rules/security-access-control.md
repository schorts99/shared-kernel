# 🛡️ Rule: Security & Access Control Standards

This rule specifies access control contracts, security policies, and identity integrations in `@schorts/shared-kernel`.

---

## 1. Role-Based Access Control (RBAC) (`src/rbac`)

RBAC evaluates permission pairs against assigned user roles.

### Standards:
1. **Permission Value Object**:
   - Encapsulates action-resource pairs formatted as `action:resource` (e.g. `read:orders`, `delete:users`).
   - Action and resource strings must be sanitized and normalized.
2. **BaseResource**:
   - Base interface/class for domain objects subjected to authorization checks. Must expose `resourceType: string` and `id: string`.
3. **RBACPolicy**:
   - Class storing role-to-permission mappings.
   - Evaluates whether a role possesses explicit or wildcard permissions (`*`, `read:*`).

---

## 2. Attribute-Based Access Control (ABAC) (`src/abac`)

ABAC extends RBAC by evaluating contextual dynamic attributes (e.g. ownership, time of day, IP subnet).

### Standards:
1. **Predicate Types**:
   - `Predicate<User, Resource>`: Synchronous boolean check `(user, resource) => boolean`.
   - `AsyncPredicate<User, Resource>`: Asynchronous check `(user, resource) => Promise<boolean>`.
   - `ContextualPredicate<User, Resource, Context>`: Evaluates runtime context parameters `(user, resource, context) => boolean`.
   - `AsyncContextualPredicate<User, Resource, Context>`: Async evaluation with runtime context.
2. **Composition**:
   - Combine predicates using boolean operators (AND, OR, NOT).
   - Ensure predicates fail-safe (evaluate to `false`) if target resources or user context attributes are missing or undefined.

---

## 3. Auth & Identity Providers (`src/auth`, `src/identity-providers`)

Framework-agnostic authentication contracts.

### Standards:
1. **AuthProvider**: Abstract contract defining `authenticate()`, `refreshToken()`, and `logout()`.
2. **IdentityProvider**: Generic interface for external auth providers (Firebase, Auth0, AWS Cognito) to verify tokens and retrieve user profile representations.
