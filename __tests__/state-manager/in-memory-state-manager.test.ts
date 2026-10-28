import {
  InMemoryStateManager,
} from "../../src";

describe("InMemoryStateManager", () => {
  it("isolates state from caller mutation and resets to the initial state", () => {
    const stateManager = new InMemoryStateManager({
      profile: { name: "Alice", roles: ["admin"] },
    });
    const readProfile = stateManager.getValue("profile");
    readProfile.name = "Tampered";
    readProfile.roles.push("hacker");
    expect(stateManager.getValue("profile")).toEqual({ name: "Alice", roles: ["admin"] });

    stateManager.setValue("profile", { name: "Bob", roles: ["user"] });
    stateManager.reset();
    expect(stateManager.getState().profile).toEqual({ name: "Alice", roles: ["admin"] });
  });

  it("triggers subscribeToKey only on deep changes and isolates listeners", () => {
    const stateManager = new InMemoryStateManager({
      user: { name: "Ada", tags: ["core"] },
      counter: 0,
    });
    const userUpdates: Array<{ name: string; tags: string[] }> = [];
    const seenByListener2: number[] = [];

    stateManager.subscribeToKey("user", (u) => {
      userUpdates.push(u);
      u.name = "mutated-by-listener-1";
    });
    stateManager.subscribe((s) => {
      seenByListener2.push(s.counter);
      expect(s.user.name).not.toBe("mutated-by-listener-1");
    });

    // Updating an unrelated key ("counter") must NOT trigger subscribeToKey("user")
    stateManager.setValue("counter", 1);
    stateManager.setValue("counter", 2);
    expect(userUpdates).toHaveLength(0);
    expect(seenByListener2).toEqual([1, 2]);

    // Setting the same deep value for "user" must NOT trigger subscribeToKey("user")
    stateManager.setValue("user", { name: "Ada", tags: ["core"] });
    expect(userUpdates).toHaveLength(0);

    // Changing "user" triggers subscribeToKey("user") once
    stateManager.setValue("user", { name: "Grace", tags: ["core", "compiler"] });
    expect(userUpdates).toHaveLength(1);
    expect(stateManager.getValue("user").name).toBe("Grace");
  });
});
