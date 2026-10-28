import {
  AbstractCommandHandler,
  CommandRegistry,
  Criteria,
  ErrorTracker,
  InMemoryCommandBus,
  InMemoryErrorStore,
  InMemoryOfflineStore,
  InMemoryStateManager,
  JSONAPIConnector,
  OfflineCommandSync,
  PaginationLinksGenerator,
  StaticRBACPolicy,
  URLCriteriaBuilder,
  URLCriteriaParser,
} from "../src";
import { NodeExecutionContext } from "../src/node";
import {
  registerTestMessages,
  TestCommand,
} from "./support/fixtures";

beforeAll(registerTestMessages);

describe("8. JSON:API, HTTP, RBAC/ABAC, StateManager, Offline, and ErrorTracking", () => {
  it("fixes URLCriteriaParser numeric/boolean/date/array_contains_any parsing, offsetResults(0), PaginationLinksGenerator, and JSONAPIConnector relative URLs", async () => {
    const baseUrl = new URL("https://api.example.com/orders?filter[tenant]=acme");
    const built = new URLCriteriaBuilder(
      baseUrl,
      Criteria.none()
        .where("amount", "GREATER_THAN", 42)
        .where("active", "EQUAL", true)
        .where("createdAt", "GREATER_THAN_OR_EQUAL", "2026-01-15T00:00:00.000Z")
        .where("tags", "ARRAY_CONTAINS_ANY", ["urgent", "vip"])
        .limitResults(10)
        .offsetResults(0),
    ).build();

    const parsed = new URLCriteriaParser(built).parse();
    expect(parsed.limit).toBe(10);
    expect(parsed.offset).toBe(0);

    const amountFilter = parsed.filters.find(f => f.field === "amount");
    expect(amountFilter?.value).toBe(42);
    expect(typeof amountFilter?.value).toBe("number");

    const activeFilter = parsed.filters.find(f => f.field === "active");
    expect(activeFilter?.value).toBe(true);

    const dateFilter = parsed.filters.find(f => f.field === "createdAt");
    expect(dateFilter?.value).toBeInstanceOf(Date);

    const tagsFilter = parsed.filters.find(f => f.field === "tags");
    expect(tagsFilter?.operator).toBe("ARRAY_CONTAINS_ANY");
    expect(tagsFilter?.value).toEqual(["urgent", "vip"]);

    // PaginationLinksGenerator preserves existing query params without duplicate '?'
    const links = new PaginationLinksGenerator(
      new URL("https://api.example.com/orders?filter[status]=open"),
    ).generate(0, 10, 25);

    expect(links.self).toBe("https://api.example.com/orders?filter[status]=open&page[offset]=0&page[limit]=10");
    expect(links.next).toBe("https://api.example.com/orders?filter[status]=open&page[offset]=10&page[limit]=10");
    expect(links.prev).toBeNull();

    // JSONAPIConnector handles relative URLs cleanly
    const requestedUrls: Array<string | URL> = [];
    const connector = new JSONAPIConnector({
      get: async url => {
        requestedUrls.push(url);
        return { data: [] } as any;
      },
      post: async () => ({ data: {} }) as any,
      put: async () => ({ data: {} }) as any,
      patch: async () => ({ data: {} }) as any,
      delete: async () => undefined as any,
    });

    await connector.findMany("/orders", {
      criteria: Criteria.none().where("page", "EQUAL", 1).limitResults(5).offsetResults(0),
      include: ["customer"],
    });
    expect(requestedUrls[0]).toBe("/orders?include=customer&filter%5Bpage%5D=1&page%5Blimit%5D=5&page%5Boffset%5D=0");
  });

  it("supports contextual and async ABAC predicates in RBACPolicy, StateManager isolation, OfflineCommandSync, and InMemoryErrorStore", async () => {
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

    // StateManager isolation
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

    // OfflineStore & OfflineCommandSync
    const executionContext = new NodeExecutionContext();
    const commandBus = new InMemoryCommandBus({ executionContext });
    const executedOfflineIds: string[] = [];

    class OfflineHandler extends AbstractCommandHandler<TestCommand, void> {
      async execute(command: TestCommand): Promise<void> {
        executedOfflineIds.push(command.getPayload().id);
      }
    }
    commandBus.register(TestCommand.TYPE, new OfflineHandler());
    CommandRegistry.register(TestCommand.TYPE, TestCommand);

    const offlineStore = new InMemoryOfflineStore();
    const offlineSync = new OfflineCommandSync(offlineStore, commandBus);

    await offlineSync.enqueueCommand(new TestCommand("corr-off", { id: "off-1" }));
    await offlineSync.enqueueCommand(new TestCommand("corr-off", { id: "off-2" }));
    expect(offlineStore.size()).toBe(2);

    const syncResult = await offlineSync.sync();
    expect(syncResult).toEqual({ processed: 2, failed: 0 });
    expect(executedOfflineIds).toEqual(["off-1", "off-2"]);
    expect(offlineStore.size()).toBe(0);

    // InMemoryErrorStore & ErrorTracker
    const errorStore = new InMemoryErrorStore({ maxErrors: 2 });
    const uploadedBatches: number[] = [];
    const tracker = new ErrorTracker(errorStore, {
      upload: async errors => {
        uploadedBatches.push(errors.length);
      },
    });

    await tracker.track(new Error("err-1"), { step: 1 });
    await tracker.track(new Error("err-2"), { step: 2 });
    await tracker.track(new Error("err-3"), { step: 3 });

    const storedErrors = await errorStore.all();
    expect(storedErrors).toHaveLength(2);
    await tracker.sync();
    expect(uploadedBatches).toEqual([2]);
    expect(await errorStore.all()).toEqual([]);
  });
});
