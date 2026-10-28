import {
  StaticRBACPolicy,
} from "../../src";
import {
  TestUUIDValue,
} from "../support/fixtures";

describe("RBACPolicy", () => {
  it("evaluates contextual and async ABAC predicates", async () => {
    const policy = new StaticRBACPolicy({
      editor: [{ resource: "document", action: "update" }],
    });

    const user = { id: "u-1" };
    const doc = { name: "document", ownerId: "u-1", locked: false };

    const syncAllowed = policy.canWithAttributes(
      user,
      "editor",
      "update",
      doc,
      [(u, r, ctx?: { bypassLock: boolean }) => u.id === r.ownerId && (!r.locked || Boolean(ctx?.bypassLock))],
      { bypassLock: true },
    );
    expect(syncAllowed).toBe(true);

    const asyncAllowed = await policy.canWithAttributesAsync(
      user,
      ["editor"],
      "update",
      { ...doc, locked: true },
      [async (u, r, ctx?: { bypassLock: boolean }) => u.id === r.ownerId && Boolean(ctx?.bypassLock)],
      { bypassLock: true },
    );
    expect(asyncAllowed).toBe(true);
  });

  it("isolates StaticRBACPolicy permissions and accepts domain users and empty predicate lists", async () => {
    const id1 = "123e4567-e89b-12d3-a456-426614174001";
    const rawPerms = [{ resource: "orders", action: "read" as const }];
    const policy = new StaticRBACPolicy({ viewer: rawPerms });
    rawPerms.push({ resource: "orders", action: "delete" as any });
    policy.getPermissions("viewer").push({ resource: "orders", action: "update" as any });

    expect(policy.can("viewer", "delete", "orders")).toBe(false);
    expect(policy.can("viewer", "update", "orders")).toBe(false);

    const domainUser = { id: new TestUUIDValue(id1) };
    const resource = { name: "orders", ownerId: id1 };
    expect(
      policy.canWithAttributes(domainUser, "viewer", "read", resource, [
        (u, r) => u.id.value === (r as typeof resource).ownerId,
      ]),
    ).toBe(true);
    expect(policy.canAnyWithAttributes(domainUser, "viewer", "read", resource, [])).toBe(true);
    await expect(
      policy.canAnyWithAttributesAsync(domainUser, "viewer", "read", resource, []),
    ).resolves.toBe(true);
  });
});
