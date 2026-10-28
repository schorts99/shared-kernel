import {
  AbstractCommandHandler,
  AbstractQueryHandler,
} from "../../src";
import type {
  CommandHandlerContext,
  QueryHandlerContext,
} from "../../src";
import {
  registerTestMessages,
  TestCommand,
  TestQuery,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("Abstract handler options", () => {
  it("derives a deterministic idempotency key that ignores createdAt and correlationId", () => {
    class IdempCmdHandler extends AbstractCommandHandler<TestCommand, void> {
      async execute(): Promise<void> {}
    }
    const idempHandler = new IdempCmdHandler();
    const cmdAttempt1 = new TestCommand(
      "corr-1",
      { id: "ord-1" },
      { id: "cmd-fixed-id", createdAt: new Date(1000) },
    );
    const cmdAttempt2 = new TestCommand(
      "corr-2",
      { id: "ord-1" },
      { id: "cmd-fixed-id", createdAt: new Date(5000) },
    );
    expect(idempHandler.getIdempotencyKey(cmdAttempt1)).toBe(
      idempHandler.getIdempotencyKey(cmdAttempt2),
    );
  });

  it("enforces the handler-level timeout option", async () => {
    class SlowTimeoutCmdHandler extends AbstractCommandHandler<TestCommand, void> {
      constructor() {
        super({ timeout: 15 });
      }
      async execute(_cmd: TestCommand, ctx: CommandHandlerContext): Promise<void> {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 200);
          ctx.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(ctx.signal?.reason);
            },
            { once: true },
          );
        });
      }
    }

    class SlowTimeoutQueryHandler extends AbstractQueryHandler<TestQuery, string> {
      constructor() {
        super({ timeout: 15 });
      }
      async execute(_qry: TestQuery, ctx: QueryHandlerContext): Promise<string> {
        return await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => resolve("done"), 200);
          ctx.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(ctx.signal?.reason);
            },
            { once: true },
          );
        });
      }
    }

    await expect(
      new SlowTimeoutCmdHandler().handle(new TestCommand("corr-t", { id: "1" })),
    ).rejects.toThrow("Command timed out after 15ms");

    await expect(
      new SlowTimeoutQueryHandler().handle(new TestQuery("corr-t", { id: "1" })),
    ).rejects.toThrow("Query timed out after 15ms");
  });
});
