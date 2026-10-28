import {
  AbstractCommandHandler,
  CommandRegistry,
  InMemoryCommandBus,
  InMemoryOfflineStore,
  OfflineCommandSync,
} from "../../src";
import type {
  CommandPrimitives,
} from "../../src";
import { NodeExecutionContext } from "../../src/node";
import {
  registerTestMessages,
  TestCommand,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("OfflineCommandSync", () => {
  it("replays queued commands through the command bus", async () => {
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
  });

  it("serializes concurrent sync calls", async () => {
    const offlineStore = new InMemoryOfflineStore<CommandPrimitives>();
    const commandBus = new InMemoryCommandBus();
    const dispatchedIds: string[] = [];

    class DelayedCmdHandler extends AbstractCommandHandler<TestCommand, void> {
      async execute(command: TestCommand): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 15));
        dispatchedIds.push(command.getPayload().id);
      }
    }
    commandBus.register(TestCommand.TYPE, new DelayedCmdHandler());

    const syncer = new OfflineCommandSync(offlineStore, commandBus, {
      hydrateCommand: (p) => TestCommand.fromPrimitives(p),
    });

    await syncer.enqueueCommand(new TestCommand("corr-1", { id: "cmd-1" }));
    await syncer.enqueueCommand(new TestCommand("corr-2", { id: "cmd-2" }));

    const [syncRes1, syncRes2] = await Promise.all([syncer.sync(), syncer.sync()]);
    expect(syncRes1.processed + syncRes2.processed).toBe(2);
    expect(dispatchedIds).toEqual(["cmd-1", "cmd-2"]);
    await commandBus.close();
  });
});
