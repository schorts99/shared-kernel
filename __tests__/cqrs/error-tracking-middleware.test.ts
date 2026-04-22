import { ErrorTrackingMiddleware } from "../../src/cqrs/error-tracking-middleware";
import { ErrorTracker } from "../../src/error-tracking";
import { Command } from "../../src/cqrs/command";
import { Query } from "../../src/cqrs/query";
import { CommandBusContext } from "../../src/cqrs/command-bus";
import { QueryBusContext } from "../../src/cqrs/query-bus";

describe("ErrorTrackingMiddleware", () => {
  let tracker: jest.Mocked<ErrorTracker>;
  let middleware: ErrorTrackingMiddleware;

  beforeEach(() => {
    tracker = {
      track: jest.fn(),
      sync: jest.fn(),
    } as unknown as jest.Mocked<ErrorTracker>;

    middleware = new ErrorTrackingMiddleware(tracker);
  });

  describe("onError (Command)", () => {
    it("should track the error and build a proper context for commands", async () => {
      const command = {
        getType: () => "CreateUserCommand",
        toPrimitives: () => ({ payload: { name: "Test" } } as any),
      } as Command;

      const error = new Error("Command failed");
      const context: CommandBusContext = {
        correlationId: "cmd-123",
        startTime: new Date("2026-01-01T00:00:00Z"),
        metadata: { userId: "user-1" },
        config: {},
        events: [],
      };

      await middleware.onError!(command, error, context);

      expect(tracker.track).toHaveBeenCalledWith(
        error,
        {
          userId: "user-1",
          requestType: "command",
          typeName: "CreateUserCommand",
          correlationId: "cmd-123",
          startTime: "2026-01-01T00:00:00.000Z",
          payload: { name: "Test" },
        },
        "Failed to execute command: CreateUserCommand"
      );
    });
  });

  describe("onError (Query)", () => {
    it("should track the error and build a proper context for queries", async () => {
      const query = {
        getType: () => "FindUserQuery",
        toPrimitives: () => ({ payload: { id: "1" } } as any),
      } as Query;

      const error = new Error("Query failed");
      const context: QueryBusContext = {
        correlationId: "qry-123",
        startTime: new Date("2026-01-01T00:00:00Z"),
        metadata: { role: "admin" },
        config: {},
      };

      await middleware.onError!(query, error, context);

      expect(tracker.track).toHaveBeenCalledWith(
        error,
        {
          role: "admin",
          requestType: "query",
          typeName: "FindUserQuery",
          correlationId: "qry-123",
          startTime: "2026-01-01T00:00:00.000Z",
          payload: { id: "1" },
        },
        "Failed to execute query: FindUserQuery"
      );
    });
  });
});
