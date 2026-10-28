import { expectTypeOf } from "expect-type";
import { StaticRBACPolicy } from "../src";
import type { AsyncPredicate, Predicate } from "../src";

type User = { id: string };
type Doc = { name: string; ownerId: string; locked: boolean };

describe("RBACPolicy ABAC predicate typing", () => {
  const policy = new StaticRBACPolicy({
    editor: [{ resource: "document", action: "update" }],
  });
  const user: User = { id: "u-1" };
  const doc: Doc = { name: "document", ownerId: "u-1", locked: false };

  it("infers parameter types for inline predicates", async () => {
    expect(
      policy.canWithAttributes(user, "editor", "update", doc, [
        (u, r) => {
          expectTypeOf(u).toEqualTypeOf<User>();
          expectTypeOf(r).toEqualTypeOf<Doc>();
          return u.id === r.ownerId;
        },
      ]),
    ).toBe(true);

    expect(
      await policy.canWithAttributesAsync(user, "editor", "update", doc, [
        async (u, r) => {
          expectTypeOf(u).toEqualTypeOf<User>();
          expectTypeOf(r).toEqualTypeOf<Doc>();
          return !r.locked;
        },
        (u, r) => u.id === r.ownerId,
      ]),
    ).toBe(true);
  });

  it("still accepts predicates typed as Predicate and AsyncPredicate", async () => {
    const isOwner: Predicate<User, Doc> = (u, r) => u.id === r.ownerId;
    const isUnlocked: AsyncPredicate<User, Doc> = async (_u, r) => !r.locked;

    expect(policy.canWithAttributes(user, "editor", "update", doc, [isOwner])).toBe(true);
    expect(policy.canAnyWithAttributes(user, "editor", "update", doc, [isOwner])).toBe(true);
    expect(await policy.canWithAttributesAsync(user, "editor", "update", doc, [isOwner, isUnlocked])).toBe(true);
    expect(await policy.canAnyWithAttributesAsync(user, "editor", "update", { ...doc, locked: true }, [isUnlocked, isOwner])).toBe(true);
  });
});
