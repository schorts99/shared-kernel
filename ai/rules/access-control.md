# Access control rules

Applies to `rbac`, `abac`, `auth`, and `identity-providers`.

- Express "which roles may do what" as RBAC permissions: `{ resource, action }`. `resource: "*"` matches every resource; actions `"*"` and `"manage"` match every action.
- Use `StaticRBACPolicy({ role: permissions[] })` for permissions known at build time. Subclass `RBACPolicy` and implement `getPermissions(role)` to load them from elsewhere; keep that method synchronous and cheap (cache what you load).
- Check roles with `policy.can(roles, action, resource)`. Resources can be a name or any object with a `name` (`asResource("orders")`).
- Express "may this user act on this record" as ABAC predicates on top of RBAC: `canWithAttributes(user, roles, action, resource, predicates, context?)` passes only if RBAC allows it **and** every predicate returns `true`. Use `canAnyWithAttributes` when one predicate is enough, and the `Async` variants for predicates that query storage.
- Write predicates inline so their parameters are typed, or declare them as `Predicate<User, Resource>` / `ContextualPredicate<User, Resource, Context>` to reuse them.
- Enforce access in `authorize` on command and query handlers (throw `CommandAuthorizationError` / `QueryAuthorizationError`) or by throwing `NotAuthorized`; never only in the UI.
- Custom actions are typed: `StaticRBACPolicy<"approve" | "refund">` accepts those plus the base actions (`read`, `write`, `create`, `update`, `delete`, `manage`, `*`).
- `InMemoryAuthProvider` and `InMemoryIdentityProvider` are for tests and local development only.

See [skills/define-access-policy](../skills/define-access-policy/SKILL.md).
