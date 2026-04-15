import { AbstractCommand, AbstractCommandHandler } from "../../src/cqrs";
import {
  CommandValidationError,
  CommandAuthorizationError,
  CommandExecutionError,
  CommandMaxRetriesExceeded,
} from "../../src/cqrs/exceptions";

describe("AbstractCommandHandler", () => {
  class TestCommand extends AbstractCommand {
    constructor(public readonly payload: string, correlationId = "corr-1") {
      super(correlationId);
    }

    getType(): string {
      return "TestCommand";
    }
  }

  class TestCommandHandler extends AbstractCommandHandler<TestCommand, string> {
    constructor(options = {}) {
      super(options);
    }

    async execute(command: TestCommand): Promise<string> {
      return `done:${command.payload}`;
    }
  }

  it("executes a command and returns the result", async () => {
    const command = new TestCommand("hello");
    const handler = new TestCommandHandler({ logging: false });

    await expect(handler.handle(command)).resolves.toBe("done:hello");
  });

  it("exposes merged handler options via getOptions", () => {
    const handler = new TestCommandHandler({ logging: true, maxRetries: 2 });
    const options = handler.getOptions();

    expect(options.logging).toBe(true);
    expect(options.maxRetries).toBe(2);
    expect(options.idempotent).toBe(false);
    expect(options.publishEvents).toBe(false);
  });

  it("returns a default idempotency key for a command", () => {
    const command = new TestCommand("hello");
    const handler = new TestCommandHandler();

    const key = handler.getIdempotencyKey(command);

    expect(key).toContain("TestCommand");
    expect(typeof key).toBe("string");
  });

  it("throws CommandValidationError from validate without wrapping it", async () => {
    class ValidationCommandHandler extends TestCommandHandler {
      async validate(_: TestCommand): Promise<void> {
        throw new CommandValidationError("invalid command");
      }
    }

    const handler = new ValidationCommandHandler();
    const command = new TestCommand("hello");

    await expect(handler.handle(command)).rejects.toThrow(CommandValidationError);
  });

  it("throws CommandAuthorizationError from authorize without wrapping it", async () => {
    class AuthorizationCommandHandler extends TestCommandHandler {
      async authorize(_: TestCommand): Promise<void> {
        throw new CommandAuthorizationError("unauthorized");
      }
    }

    const handler = new AuthorizationCommandHandler();
    const command = new TestCommand("hello");

    await expect(handler.handle(command)).rejects.toThrow(CommandAuthorizationError);
  });

  it("wraps unexpected errors in CommandExecutionError", async () => {
    class ErrorCommandHandler extends TestCommandHandler {
      async execute(_: TestCommand): Promise<string> {
        throw new Error("boom");
      }
    }

    const handler = new ErrorCommandHandler();
    const command = new TestCommand("hello");

    await expect(handler.handle(command)).rejects.toThrow(CommandExecutionError);
    await expect(handler.handle(command)).rejects.toMatchObject({ code: "COMMAND_EXECUTION_FAILED" });
  });

  it("rethrows CommandExecutionError thrown by execute unchanged", async () => {
    class ExecutionErrorCommandHandler extends TestCommandHandler {
      async execute(_: TestCommand): Promise<string> {
        throw new CommandExecutionError("execution failed", "CUSTOM_EXECUTION_ERROR");
      }
    }

    const handler = new ExecutionErrorCommandHandler();
    const command = new TestCommand("hello");

    await expect(handler.handle(command)).rejects.toThrow(CommandExecutionError);
    await expect(handler.handle(command)).rejects.toMatchObject({ code: "CUSTOM_EXECUTION_ERROR" });
  });

  it("retries on CommandExecutionError and throws CommandMaxRetriesExceeded after exceeding retries", async () => {
    class RetryCommandHandler extends TestCommandHandler {
      async execute(_: TestCommand): Promise<string> {
        throw new CommandExecutionError("temporary failure", "COMMAND_EXECUTION_ERROR");
      }
    }

    const handler = new RetryCommandHandler({ maxRetries: 1 });
    const command = new TestCommand("hello");

    await expect(handler.handle(command)).rejects.toThrow(CommandMaxRetriesExceeded);
    await expect(handler.handle(command)).rejects.toMatchObject({ retryCount: 1 });
  });
});
