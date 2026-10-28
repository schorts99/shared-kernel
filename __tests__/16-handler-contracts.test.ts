import {
  AbstractCommand,
  AbstractCommandHandler,
  AbstractQuery,
  AbstractQueryHandler,
  InMemoryCommandBus,
  InMemoryQueryBus,
} from "../src";
import type { CommandHandler, QueryHandler } from "../src";

class RenameCommand extends AbstractCommand<{ name: string }> {
  static readonly TYPE = "contract.rename";

  getType(): string {
    return RenameCommand.TYPE;
  }
}

class LookupQuery extends AbstractQuery<{ id: string }> {
  static readonly TYPE = "contract.lookup";

  getType(): string {
    return LookupQuery.TYPE;
  }
}

describe("CommandHandler and QueryHandler contracts", () => {
  it("accepts hand-written handlers that implement only handle", async () => {
    const commandHandler: CommandHandler<RenameCommand, string> = {
      handle: async command => command.getPayload().name.toUpperCase(),
    };
    const queryHandler: QueryHandler<LookupQuery, string> = {
      handle: async query => `found:${query.getPayload().id}`,
    };
    const commandBus = new InMemoryCommandBus();
    const queryBus = new InMemoryQueryBus();

    commandBus.register(RenameCommand.TYPE, commandHandler);
    queryBus.register(LookupQuery.TYPE, queryHandler);

    expect(await commandBus.dispatch(new RenameCommand("corr-1", { name: "ada" }))).toBe("ADA");
    expect(await queryBus.dispatch(new LookupQuery("corr-2", { id: "7" }))).toBe("found:7");
  });

  it("runs abstract handlers' validate and authorize before their protected execute", async () => {
    const calls: string[] = [];

    class RenameHandler extends AbstractCommandHandler<RenameCommand, string> {
      override async validate(command: RenameCommand): Promise<void> {
        calls.push("validate");
        if (!command.getPayload().name) throw new Error("name is required");
      }

      override async authorize(): Promise<void> {
        calls.push("authorize");
      }

      protected async execute(command: RenameCommand): Promise<string> {
        calls.push("execute");
        return command.getPayload().name;
      }
    }

    class LookupHandler extends AbstractQueryHandler<LookupQuery, string> {
      protected async execute(query: LookupQuery): Promise<string> {
        return query.getPayload().id;
      }
    }

    const handler = new RenameHandler();
    const commandBus = new InMemoryCommandBus();
    const queryBus = new InMemoryQueryBus();
    commandBus.register(RenameCommand.TYPE, handler);
    queryBus.register(LookupQuery.TYPE, new LookupHandler());

    expect(await commandBus.dispatch(new RenameCommand("corr-3", { name: "grace" }))).toBe("grace");
    expect(calls).toEqual(["validate", "authorize", "execute"]);
    await expect(commandBus.dispatch(new RenameCommand("corr-4", { name: "" }))).rejects.toThrow("name is required");
    expect(calls).toEqual(["validate", "authorize", "execute", "validate"]);
    expect(await queryBus.dispatch(new LookupQuery("corr-5", { id: "42" }))).toBe("42");

    // execute is only reachable through handle, so its checks cannot be skipped.
    // @ts-expect-error execute is protected
    expect(typeof handler.execute).toBe("function");
  });
});
