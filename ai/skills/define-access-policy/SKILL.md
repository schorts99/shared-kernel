---
name: define-access-policy
description: Restrict who can do what with @schorts/shared-kernel — RBAC roles and permissions with StaticRBACPolicy and custom actions, ABAC predicates for record-level rules (ownership, tenant, state), enforcement in command and query handlers' authorize, and tests. Use when adding roles, permissions, or "only the owner can…" rules.
---

# Define an access policy

RBAC answers "may this role perform this action on this kind of resource?". ABAC predicates answer "…on this particular record?". This skill protects document editing and approval.

## 1. Roles and permissions

- One permission is `{ resource, action }`. `resource: "*"` matches every resource; actions `"manage"` and `"*"` match every action.
- Add your own actions with the type parameter; the base actions (`read`, `write`, `create`, `update`, `delete`, `manage`, `*`) are always allowed.
- Use `StaticRBACPolicy` when permissions are fixed in code. To load them from storage, subclass `RBACPolicy` and implement a cheap, synchronous `getPermissions(role)` over a cache.

```ts
// file: access/policy.ts
import { StaticRBACPolicy } from "@schorts/shared-kernel/rbac";

export type DocumentAction = "approve" | "archive";

export const policy = new StaticRBACPolicy<DocumentAction>({
  viewer: [{ resource: "documents", action: "read" }],
  editor: [
    { resource: "documents", action: "read" },
    { resource: "documents", action: "update" },
  ],
  approver: [
    { resource: "documents", action: "read" },
    { resource: "documents", action: "approve" },
  ],
  admin: [{ resource: "*", action: "manage" }],
});
```

## 2. Record-level rules

- A resource passed to `canWithAttributes` needs a `name` matching the RBAC resource; add the fields your predicates read.
- Write predicates inline (their parameters are typed) or as named `Predicate`/`ContextualPredicate` values to reuse them.
- `canWithAttributes` requires RBAC **and** every predicate; `canAnyWithAttributes` requires RBAC and at least one predicate (or none given).

```ts
// file: access/document-rules.ts
import type { ContextualPredicate, Predicate } from "@schorts/shared-kernel/abac";
import { policy } from "./policy.js";
import type { DocumentAction } from "./policy.js";

export type Actor = { id: string; tenantId: string; roles: string[] };
export type DocumentResource = {
  name: "documents";
  ownerId: string;
  tenantId: string;
  status: "draft" | "submitted" | "approved";
};

export const sameTenant: Predicate<Actor, DocumentResource> = (actor, doc) => actor.tenantId === doc.tenantId;
export const isOwner: Predicate<Actor, DocumentResource> = (actor, doc) => actor.id === doc.ownerId;
export const notApproved: ContextualPredicate<Actor, DocumentResource, { overrideLock?: boolean }> = (
  _actor,
  doc,
  context,
) => doc.status !== "approved" || context?.overrideLock === true;

export function canEdit(actor: Actor, doc: DocumentResource, context: { overrideLock?: boolean } = {}): boolean {
  return policy.canWithAttributes(actor, actor.roles, "update", doc, [sameTenant, isOwner, notApproved], context);
}

export function canApprove(actor: Actor, doc: DocumentResource): boolean {
  const action: DocumentAction = "approve";
  return policy.canWithAttributes(actor, actor.roles, action, doc, [
    sameTenant,
    (approver, document) => approver.id !== document.ownerId && document.status === "submitted",
  ]);
}
```

## 3. Enforce it in handlers

Check access in `authorize`, which the bus runs before `execute`. Throw `CommandAuthorizationError` (or `QueryAuthorizationError` for queries) so callers can map it to 403.

```ts
// file: access/approve-document.ts
import { AbstractCommand, AbstractCommandHandler, CommandAuthorizationError } from "@schorts/shared-kernel/cqrs";
import { canApprove } from "./document-rules.js";
import type { Actor, DocumentResource } from "./document-rules.js";

export class ApproveDocument extends AbstractCommand<{ documentId: string }> {
  static readonly TYPE = "documents.approve";
  getType(): string {
    return ApproveDocument.TYPE;
  }
}

export interface DocumentDirectory {
  findResource(documentId: string): Promise<DocumentResource | null>;
  findActor(userId: string): Promise<Actor | null>;
  approve(documentId: string, approverId: string): Promise<void>;
}

export class ApproveDocumentHandler extends AbstractCommandHandler<ApproveDocument> {
  constructor(private readonly directory: DocumentDirectory) {
    super();
  }

  override async authorize(command: ApproveDocument): Promise<void> {
    const { userId } = command.getMetadata();
    const actor = userId ? await this.directory.findActor(userId) : null;
    const doc = await this.directory.findResource(command.getPayload().documentId);

    if (!actor || !doc || !canApprove(actor, doc)) {
      throw new CommandAuthorizationError("You cannot approve this document", "DOCUMENT_APPROVAL_DENIED");
    }
  }

  protected async execute(command: ApproveDocument): Promise<void> {
    const { userId } = command.getMetadata();
    await this.directory.approve(command.getPayload().documentId, userId ?? "");
  }
}
```

Never rely on hiding buttons in the UI alone; the handler check is the one that counts.

## 4. Test it

Test the rules as a table, and the handler through the bus:

```ts
// file: access/document-rules.test.ts
import { CommandAuthorizationError, InMemoryCommandBus } from "@schorts/shared-kernel/cqrs";
import { ApproveDocument, ApproveDocumentHandler } from "./approve-document.js";
import type { DocumentDirectory } from "./approve-document.js";
import { canApprove, canEdit } from "./document-rules.js";
import type { Actor, DocumentResource } from "./document-rules.js";

const owner: Actor = { id: "u-1", tenantId: "t-1", roles: ["editor"] };
const approver: Actor = { id: "u-2", tenantId: "t-1", roles: ["approver"] };
const outsider: Actor = { id: "u-3", tenantId: "t-2", roles: ["admin"] };
const draft: DocumentResource = { name: "documents", ownerId: "u-1", tenantId: "t-1", status: "draft" };
const submitted: DocumentResource = { ...draft, status: "submitted" };

describe("document rules", () => {
  it.each([
    ["owner edits own draft", canEdit(owner, draft), true],
    ["owner edits approved document", canEdit(owner, { ...draft, status: "approved" }), false],
    ["owner overrides the approval lock", canEdit(owner, { ...draft, status: "approved" }, { overrideLock: true }), true],
    ["approver edits", canEdit(approver, draft), false],
    ["approver approves submitted document", canApprove(approver, submitted), true],
    ["owner approves own document", canApprove({ ...owner, roles: ["approver"] }, submitted), false],
    ["admin from another tenant approves", canApprove(outsider, submitted), false],
  ])("%s", (_case, allowed, expected) => {
    expect(allowed).toBe(expected);
  });

  it("rejects unauthorized approvals before running the command", async () => {
    const approved: string[] = [];
    const directory: DocumentDirectory = {
      findResource: async () => submitted,
      findActor: async id => [owner, approver].find(actor => actor.id === id) ?? null,
      approve: async documentId => {
        approved.push(documentId);
      },
    };
    const commandBus = new InMemoryCommandBus();
    commandBus.register(ApproveDocument.TYPE, new ApproveDocumentHandler(directory));

    await expect(
      commandBus.dispatch(new ApproveDocument("corr-1", { documentId: "d-1" }, { userId: owner.id })),
    ).rejects.toBeInstanceOf(CommandAuthorizationError);
    await commandBus.dispatch(new ApproveDocument("corr-2", { documentId: "d-1" }, { userId: approver.id }));

    expect(approved).toEqual(["d-1"]);
  });
});
```

## Checklist

- [ ] Permissions as `{ resource, action }`; custom actions declared in the policy's type parameter.
- [ ] Record-level rules as predicates, combined with `canWithAttributes`/`canAnyWithAttributes`.
- [ ] Enforcement in handler `authorize`, throwing `CommandAuthorizationError`/`QueryAuthorizationError`.
- [ ] Rule tests as a table; handler tests through the bus.
