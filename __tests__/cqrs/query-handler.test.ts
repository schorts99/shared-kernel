import { AbstractQuery } from "../../src/cqrs/query";
import { AbstractQueryHandler, QueryHandlerContext } from "../../src/cqrs/query-handler";
import { QueryValidationError, QueryAuthorizationError, QueryExecutionError } from "../../src/cqrs/exceptions";

describe("AbstractQueryHandler", () => {
  class TestQuery extends AbstractQuery {
    constructor(public readonly payload: string, correlationId = "corr-1") {
      super(correlationId);
    }

    getType(): string {
      return "TestQuery";
    }
  }

  class TestQueryHandler extends AbstractQueryHandler<TestQuery, string> {
    constructor(options = {}) {
      super(options);
    }

    async execute(query: TestQuery, context: QueryHandlerContext): Promise<string> {
      expect(context.correlationId).toBe(query.getMetadata().correlationId);
      expect(context.metadata()).toBe(query.getMetadata());
      expect(context.options).toBe(this.getOptions());
      expect(context.startTime).toBeInstanceOf(Date);
      return `result:${query.payload}`;
    }
  }

  it("executes the query and returns the result", async () => {
    const query = new TestQuery("hello", "corr-1");
    const handler = new TestQueryHandler({ logging: false });

    const result = await handler.handle(query);

    expect(result).toBe("result:hello");
  });

  it("exposes merged handler options via getOptions()", () => {
    const handler = new TestQueryHandler({ cache: true, timeout: 2000 });
    const options = handler.getOptions();

    expect(options.cache).toBe(true);
    expect(options.timeout).toBe(2000);
    expect(options.cacheTtl).toBe(5 * 60 * 1000);
    expect(options.logging).toBe(false);
  });

  it("throws QueryValidationError from validate without wrapping it", async () => {
    class ValidationQueryHandler extends TestQueryHandler {
      public async validate(_: TestQuery): Promise<void> {
        throw new QueryValidationError("invalid query");
      }
    }

    const query = new TestQuery("hello", "corr-2");
    const handler = new ValidationQueryHandler();

    await expect(handler.handle(query)).rejects.toThrow(QueryValidationError);
  });

  it("throws QueryAuthorizationError from authorize without wrapping it", async () => {
    class AuthorizationQueryHandler extends TestQueryHandler {
      public async authorize(_: TestQuery): Promise<void> {
        throw new QueryAuthorizationError("not allowed");
      }
    }

    const query = new TestQuery("hello", "corr-3");
    const handler = new AuthorizationQueryHandler();

    await expect(handler.handle(query)).rejects.toThrow(QueryAuthorizationError);
  });

  it("wraps unexpected execution errors in QueryExecutionError", async () => {
    class ErrorQueryHandler extends TestQueryHandler {
      public async execute(_: TestQuery, __: QueryHandlerContext): Promise<string> {
        throw new Error("boom");
      }
    }

    const query = new TestQuery("hello", "corr-4");
    const handler = new ErrorQueryHandler();

    await expect(handler.handle(query)).rejects.toThrow(QueryExecutionError);
    await expect(handler.handle(query)).rejects.toMatchObject({ code: "QUERY_EXECUTION_FAILED" });
  });

  it("rethrows QueryExecutionError thrown by execute unchanged", async () => {
    class ExecutionErrorQueryHandler extends TestQueryHandler {
      public async execute(_: TestQuery, __: QueryHandlerContext): Promise<string> {
        throw new QueryExecutionError("execution failed", "CUSTOM_EXECUTION_ERROR");
      }
    }

    const query = new TestQuery("hello", "corr-5");
    const handler = new ExecutionErrorQueryHandler();

    await expect(handler.handle(query)).rejects.toThrow(QueryExecutionError);
    await expect(handler.handle(query)).rejects.toMatchObject({ code: "CUSTOM_EXECUTION_ERROR" });
  });
});
