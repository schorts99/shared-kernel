import {
  InMemoryIdentityProvider,
} from "../../src";

describe("InMemoryIdentityProvider", () => {
  it("issues and verifies tokens with custom claims and revokes them on delete", async () => {
    const idp = new InMemoryIdentityProvider();
    const createdUser = await idp.createUser({
      email: "grace@example.com",
      displayName: "Grace Hopper",
      emailVerified: true,
    });
    await idp.setCustomClaims(createdUser.id, { tier: "enterprise" });

    const idpToken = idp.issueToken(createdUser.id, undefined, { scope: "full" });
    const verified = await idp.verifyToken(idpToken);
    expect(verified).toEqual({
      userId: createdUser.id,
      claims: { tier: "enterprise", scope: "full" },
    });

    await idp.deleteUser(createdUser.id);
    await expect(idp.verifyToken(idpToken)).rejects.toThrow();
  });
});
