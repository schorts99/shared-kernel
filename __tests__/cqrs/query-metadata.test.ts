import type { QueryMetadata, QueryPrimitives } from "../../src/cqrs/query-metadata";

describe("QueryMetadata shapes", () => {
  it("accepts a fully populated QueryMetadata object", () => {
    const metadata: QueryMetadata = {
      id: "query-1",
      createdAt: new Date("2026-04-09T12:00:00Z"),
      correlationId: "corr-1",
      causationId: "cause-1",
      requestId: "req-1",
      version: 2,
      userId: "user-1",
      tenantId: "tenant-1",
      headers: { authorization: "Bearer token" },
      context: { locale: "en-US" },
    };

    expect(metadata).toEqual({
      id: "query-1",
      createdAt: new Date("2026-04-09T12:00:00Z"),
      correlationId: "corr-1",
      causationId: "cause-1",
      requestId: "req-1",
      version: 2,
      userId: "user-1",
      tenantId: "tenant-1",
      headers: { authorization: "Bearer token" },
      context: { locale: "en-US" },
    });
  });

  it("accepts optional undefined fields in QueryMetadata", () => {
    const metadata: QueryMetadata = {
      id: "query-2",
      createdAt: new Date("2026-04-09T12:00:00Z"),
      correlationId: "corr-2",
      causationId: undefined,
      requestId: undefined,
      version: 1,
      userId: undefined,
      tenantId: undefined,
      headers: undefined,
      context: undefined,
    };

    expect(metadata.causationId).toBeUndefined();
    expect(metadata.requestId).toBeUndefined();
    expect(metadata.headers).toBeUndefined();
    expect(metadata.context).toBeUndefined();
  });
});

describe("QueryPrimitives shapes", () => {
  it("accepts a fully populated QueryPrimitives object", () => {
    const primitives: QueryPrimitives = {
      id: "query-3",
      type: "TestQuery",
      created_at: "2026-04-09T12:00:00Z",
      correlation_id: "corr-3",
      causation_id: "cause-3",
      request_id: "req-3",
      version: 3,
      user_id: "user-3",
      tenant_id: "tenant-3",
      payload: { value: 123 },
      headers: { authorization: "Bearer token" },
      context: { locale: "en-US" },
    };

    expect(primitives).toEqual({
      id: "query-3",
      type: "TestQuery",
      created_at: "2026-04-09T12:00:00Z",
      correlation_id: "corr-3",
      causation_id: "cause-3",
      request_id: "req-3",
      version: 3,
      user_id: "user-3",
      tenant_id: "tenant-3",
      payload: { value: 123 },
      headers: { authorization: "Bearer token" },
      context: { locale: "en-US" },
    });
  });

  it("accepts optional undefined fields in QueryPrimitives", () => {
    const primitives: QueryPrimitives = {
      id: "query-4",
      type: "TestQuery",
      created_at: "2026-04-09T12:00:00Z",
      correlation_id: "corr-4",
      causation_id: undefined,
      request_id: undefined,
      version: 1,
      user_id: undefined,
      tenant_id: undefined,
      payload: {},
      headers: undefined,
      context: undefined,
    };

    expect(primitives.causation_id).toBeUndefined();
    expect(primitives.request_id).toBeUndefined();
    expect(primitives.headers).toBeUndefined();
    expect(primitives.context).toBeUndefined();
  });
});
