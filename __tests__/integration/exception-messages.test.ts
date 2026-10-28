import {
  AuthenticationError,
  CommandAlreadyProcessing,
  CommandAuthorizationError,
  CommandExecutionError,
  CommandHandlerNotRegistered,
  CommandMaxRetriesExceeded,
  CommandNotRegistered,
  CommandPostCommitError,
  CommandValidationError,
  ConversionError,
  DomainEventNotRegistered,
  EntityNotRegistered,
  JSONAPIErrors,
  LimitNotValid,
  NotAuthenticated,
  NotAuthorized,
  OffsetNotValid,
  QueryAuthorizationError,
  QueryExecutionError,
  QueryHandlerNotRegistered,
  QueryNotRegistered,
  QueryValidationError,
  RequireAuthNotImplementedCorrectly,
  SharedKernelTranslationKeys,
} from "../../src";
import type { TranslationResolver } from "../../src";

class RecordingResolver implements TranslationResolver {
  readonly calls: Array<{ key: string; params: Record<string, unknown> | undefined }> = [];

  resolve(key: string, params?: Record<string, unknown>): string {
    this.calls.push({ key, params });
    return `translated:${key}`;
  }
}

type TranslatableCase = {
  name: string;
  create: (resolver?: TranslationResolver) => Error;
  defaultMessage: string;
  key: string;
  params?: Record<string, unknown>;
};

const translatable: TranslatableCase[] = [
  { name: "NotAuthenticated", create: r => new NotAuthenticated(r), defaultMessage: "Not Authenticated", key: SharedKernelTranslationKeys.auth.errors.NotAuthenticated },
  { name: "RequireAuthNotImplementedCorrectly", create: r => new RequireAuthNotImplementedCorrectly(r), defaultMessage: "RequireAuth decorator not implemented correctly", key: SharedKernelTranslationKeys.auth.errors.RequireAuthNotImplementedCorrectly },
  { name: "CommandNotRegistered", create: r => new CommandNotRegistered("orders.create", r), defaultMessage: "Command Not Registered: orders.create", key: SharedKernelTranslationKeys.cqrs.errors.CommandNotRegistered, params: { command: "orders.create" } },
  { name: "QueryNotRegistered", create: r => new QueryNotRegistered("orders.get", r), defaultMessage: "Query Not Registered: orders.get", key: SharedKernelTranslationKeys.cqrs.errors.QueryNotRegistered, params: { query: "orders.get" } },
  { name: "CommandHandlerNotRegistered", create: r => new CommandHandlerNotRegistered("orders.create", r), defaultMessage: "Command Handler Not Registered: orders.create", key: SharedKernelTranslationKeys.cqrs.errors.CommandHandlerNotRegistered, params: { command: "orders.create" } },
  { name: "QueryHandlerNotRegistered", create: r => new QueryHandlerNotRegistered("orders.get", r), defaultMessage: "Query Handler Not Registered: orders.get", key: SharedKernelTranslationKeys.cqrs.errors.QueryHandlerNotRegistered, params: { query: "orders.get" } },
  { name: "LimitNotValid", create: r => new LimitNotValid(0, r), defaultMessage: "Limit Not Valid: 0", key: SharedKernelTranslationKeys.criteria.errors.LimitNotValid, params: { limit: 0 } },
  { name: "OffsetNotValid", create: r => new OffsetNotValid(-1, r), defaultMessage: "Offset Not Valid: -1", key: SharedKernelTranslationKeys.criteria.errors.OffsetNotValid, params: { offset: -1 } },
  { name: "DomainEventNotRegistered", create: r => new DomainEventNotRegistered("order.created", r), defaultMessage: "DomainEvent Not Registered: order.created", key: SharedKernelTranslationKeys.domainEvents.errors.DomainEventNotRegistered, params: { domainEventName: "order.created" } },
  { name: "EntityNotRegistered", create: r => new EntityNotRegistered("order", r), defaultMessage: "Entity Not Registered: order", key: SharedKernelTranslationKeys.entities.errors.EntityNotRegistered, params: { entityName: "order" } },
  { name: "NotAuthorized", create: r => new NotAuthorized(r), defaultMessage: "Not Authorized", key: SharedKernelTranslationKeys.rbac.errors.NotAuthorized },
];

describe("Exception messages", () => {
  it.each(translatable)("$name uses its default message and name without a resolver", ({ name, create, defaultMessage }) => {
    const error = create();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(name);
    expect(error.message).toBe(defaultMessage);
  });

  it.each(translatable)("$name resolves its message through a TranslationResolver", ({ create, key, params }) => {
    const resolver = new RecordingResolver();
    const error = create(resolver);

    expect(error.message).toBe(`translated:${key}`);
    expect(resolver.calls).toEqual([{ key, params }]);
  });

  it("NotAuthorized accepts a plain message", () => {
    expect(new NotAuthorized("Only owners can archive orders").message).toBe("Only owners can archive orders");
  });
});

describe("Coded exceptions", () => {
  it.each([
    { name: "AuthenticationError", Ctor: AuthenticationError, code: "AUTHENTICATION_FAILED" },
    { name: "ConversionError", Ctor: ConversionError, code: "CONVERSION_FAILED" },
    { name: "QueryValidationError", Ctor: QueryValidationError, code: "QUERY_VALIDATION_FAILED" },
    { name: "QueryAuthorizationError", Ctor: QueryAuthorizationError, code: "QUERY_AUTHORIZATION_FAILED" },
    { name: "QueryExecutionError", Ctor: QueryExecutionError, code: "QUERY_EXECUTION_FAILED" },
  ])("$name defaults its code and keeps custom codes and details", ({ name, Ctor, code }) => {
    const withDefaults = new Ctor("failed");
    expect(withDefaults).toBeInstanceOf(Ctor);
    expect(withDefaults.name).toBe(name);
    expect(withDefaults.message).toBe("failed");
    expect(withDefaults.code).toBe(code);
    expect(withDefaults.details).toBeUndefined();

    const custom = new Ctor("failed", "CUSTOM", { field: "email" });
    expect(custom.code).toBe("CUSTOM");
    expect(custom.details).toEqual({ field: "email" });
  });

  it.each([
    { name: "CommandValidationError", Ctor: CommandValidationError, code: "COMMAND_VALIDATION_ERROR" },
    { name: "CommandAuthorizationError", Ctor: CommandAuthorizationError, code: "COMMAND_AUTHORIZATION_ERROR" },
    { name: "CommandExecutionError", Ctor: CommandExecutionError, code: "COMMAND_EXECUTION_ERROR" },
  ])("$name defaults its code, keeps context, and survives instanceof checks", ({ name, Ctor, code }) => {
    const withDefaults = new Ctor("failed");
    expect(withDefaults).toBeInstanceOf(Ctor);
    expect(withDefaults.name).toBe(name);
    expect(withDefaults.code).toBe(code);
    expect(withDefaults.context).toBeUndefined();

    const custom = new Ctor("failed", "CUSTOM", { orderId: "o-1" });
    expect(custom.code).toBe("CUSTOM");
    expect(custom.context).toEqual({ orderId: "o-1" });
  });

  it("CommandAlreadyProcessing and CommandMaxRetriesExceeded keep their details", () => {
    const processing = new CommandAlreadyProcessing("busy", "key-1");
    expect(processing).toBeInstanceOf(CommandAlreadyProcessing);
    expect(processing.name).toBe("CommandAlreadyProcessing");
    expect(processing.idempotencyKey).toBe("key-1");
    expect(processing.code).toBe("COMMAND_ALREADY_PROCESSING");
    expect(new CommandAlreadyProcessing("busy", "key-1", "CUSTOM").code).toBe("CUSTOM");

    const lastError = new Error("timeout");
    const exceeded = new CommandMaxRetriesExceeded("gave up", 3, lastError);
    expect(exceeded).toBeInstanceOf(CommandMaxRetriesExceeded);
    expect(exceeded.name).toBe("CommandMaxRetriesExceeded");
    expect(exceeded.retryCount).toBe(3);
    expect(exceeded.lastError).toBe(lastError);
    expect(exceeded.code).toBe("COMMAND_MAX_RETRIES_EXCEEDED");
  });

  it("CommandPostCommitError says whether completion can be retried and keeps the cause", () => {
    const cause = new Error("publish failed");

    const unsafe = new CommandPostCommitError(cause);
    expect(unsafe.committed).toBe(true);
    expect(unsafe.canRetryCompletion).toBe(false);
    expect(unsafe.cause).toBe(cause);
    expect(unsafe.message).toContain("rerunning the command may repeat side effects");

    const retryable = new CommandPostCommitError(cause, true);
    expect(retryable.canRetryCompletion).toBe(true);
    expect(retryable.message).toContain("retry with the same idempotency key");
    expect(retryable.name).toBe("CommandPostCommitError");
  });

  it("JSONAPIErrors builds its message from titles, details, codes, and statuses", () => {
    expect(new JSONAPIErrors([
      { status: "422", code: "invalid", title: "Invalid", detail: "total must be positive" },
      { status: "422", code: "missing", title: "", detail: "name is required" },
      { status: "409", code: "conflict", title: "Conflict", detail: "" },
      { status: "500", code: "", title: "", detail: "" },
    ]).message).toBe("Invalid: total must be positive; name is required; Conflict; 500");
    expect(new JSONAPIErrors([]).message).toBe("JSON:API Errors");
    expect(new JSONAPIErrors([], "custom").message).toBe("custom");
  });
});
