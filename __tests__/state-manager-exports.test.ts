import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as kernel from "../src";
import * as stateManagers from "../src/state-manager";

describe("framework-neutral state management exports", () => {
  it("keeps the core state managers available from both entrypoints", () => {
    expect(kernel.StateManager).toBe(stateManagers.StateManager);
    expect(kernel.InMemoryStateManager).toBe(stateManagers.InMemoryStateManager);
  });

  it.each(["LocalStorageStateManager", "SessionStorageStateManager"])(
    "does not export %s from either entrypoint",
    (name) => {
      expect(kernel).not.toHaveProperty(name);
      expect(stateManagers).not.toHaveProperty(name);
    }
  );

  it("does not export the guided tour implementation from the package root", () => {
    expect(kernel).not.toHaveProperty("BaseTourGuide");
  });

  it("removes the tour subpath while preserving the state-manager subpath", () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));

    expect(manifest.exports).not.toHaveProperty(["./tour-guide"]);
    expect(manifest.exports).toHaveProperty(["./state-manager"]);
  });

  it("preserves in-memory updates, subscriptions, and reset without browser storage", () => {
    const manager = new stateManagers.InMemoryStateManager({ count: 0 });
    const listener = jest.fn();
    const unsubscribe = manager.subscribe(listener);

    manager.setValue("count", 1);
    expect(manager.getValue("count")).toBe(1);
    expect(listener).toHaveBeenLastCalledWith({ count: 1 });

    manager.patch({ count: 2 });
    expect(manager.getState()).toEqual({ count: 2 });

    manager.reset();
    expect(manager.getState()).toEqual({ count: 0 });
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    manager.setValue("count", 3);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
