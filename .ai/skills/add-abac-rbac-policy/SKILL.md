---
name: add-abac-rbac-policy
description: Procedure for creating RBAC security policies and composable ABAC predicate checks.
---

# 🛠️ Skill: Create Security Policies (RBAC & ABAC)

This skill explains how to build role-based authorization policies and attribute-based security predicates.

---

## Step 1: Define RBAC Permissions & Policy

1. Create permissions using action:resource strings via `Permission`.
2. Define role mappings in `RBACPolicy`.

```typescript
import { Permission, RBACPolicy } from "@schorts/shared-kernel/rbac";

const readOrders = new Permission("read", "orders");
const writeOrders = new Permission("write", "orders");
const deleteOrders = new Permission("delete", "orders");

const policy = new RBACPolicy();

policy.grantRole("viewer", [readOrders]);
policy.grantRole("editor", [readOrders, writeOrders]);
policy.grantRole("admin", [readOrders, writeOrders, deleteOrders]);

// Evaluate authorization
const canDelete = policy.isAllowed("editor", deleteOrders); // false
```

---

## Step 2: Implement ABAC Predicates

Define contextual predicates for attribute-based resource authorization (e.g. checking resource ownership):

```typescript
import { Predicate } from "@schorts/shared-kernel/abac";
import { BaseResource } from "@schorts/shared-kernel/rbac";

interface User {
  id: string;
  role: string;
}

interface OrderResource extends BaseResource {
  ownerId: string;
}

export const isOrderOwner: Predicate<User, OrderResource> = (user, order) => {
  return user.id === order.ownerId;
};

export const isOwnerOrAdmin: Predicate<User, OrderResource> = (user, order) => {
  if (user.role === "admin") return true;
  return isOrderOwner(user, order);
};
```

---

## Step 3: Integrate with Application Services

Evaluate policy and predicates prior to executing domain commands:

```typescript
if (!policy.isAllowed(user.role, readOrders)) {
  throw new Error("Unauthorized");
}

if (!isOrderOwner(user, orderResource)) {
  throw new Error("Forbidden: You do not own this resource");
}
```
