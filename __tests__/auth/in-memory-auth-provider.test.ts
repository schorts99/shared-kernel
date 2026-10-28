import {
  Entity,
  InMemoryAuthProvider,
  UUIDValue,
} from "../../src";
import {
  TestUUIDValue,
} from "../support/fixtures";

describe("InMemoryAuthProvider", () => {
  it("authenticates, refreshes, logs out, and notifies auth changes", async () => {
    class AuthUserEntity extends Entity<UUIDValue, { id: string; name: string }> {
      constructor(id: UUIDValue, public name: string) {
        super(id);
      }
      protected override createId(rawId: string): UUIDValue {
        return TestUUIDValue.fromPrimitives(rawId);
      }
      toPrimitives() {
        return { id: this.id.value, name: this.name };
      }
      override restoreFromPrimitives(data: { id: string; name: string }): void {
        this.name = data.name;
      }
    }

    const authUser = new AuthUserEntity(
      new TestUUIDValue("123e4567-e89b-12d3-a456-426614174000"),
      "Ada",
    );
    const authProvider = new InMemoryAuthProvider({
      users: [
        {
          user: authUser,
          email: "ada@example.com",
          password: "secret",
          roles: ["admin"],
          permissions: [{ resource: "orders", action: "read" }],
        },
      ],
    });

    const authEvents: Array<string | null> = [];
    const unsubscribe = authProvider.onAuthChange(session => {
      authEvents.push(session ? String(session.user.id.value) : null);
    });

    const authResult = await authProvider.authenticate({
      email: "ada@example.com",
      password: "secret",
    });
    expect(authResult.token).toContain("access_");
    expect(await authProvider.isAuthenticated()).toBe(true);
    expect(await authProvider.getCurrentUserRoles()).toEqual(["admin"]);

    const refreshed = await authProvider.refreshToken(authResult.refreshToken);
    expect(refreshed.token).not.toBe(authResult.token);

    await authProvider.logout();
    expect(await authProvider.isAuthenticated()).toBe(false);
    unsubscribe();
    expect(authEvents).toEqual([
      "123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174000",
      null,
    ]);
  });
});
