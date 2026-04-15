import { AbstractQuery } from "../../src/cqrs/query";

describe("AbstractQuery", () => {
  class TestQuery extends AbstractQuery {
    constructor(public readonly name: string, correlationId = "corr-1", customMetadata?: Partial<any>) {
      super(correlationId, customMetadata);
    }

    getType(): string {
      return "TestQuery";
    }
  }

  it("initializes metadata and generates primitives", () => {
    const query = new TestQuery("alice", "corr-1");
    const metadata = query.getMetadata();
    const primitives = query.toPrimitives();

    expect(metadata.correlationId).toBe("corr-1");
    expect(metadata.createdAt).toBeInstanceOf(Date);
    expect(metadata.id).toBeDefined();
    expect(primitives).toMatchObject({
      type: "TestQuery",
      correlation_id: "corr-1",
      payload: {},
      headers: metadata.headers,
      context: metadata.context,
    });
    expect(primitives.id).toBe(metadata.id);
    expect(primitives.request_id).toBe(metadata.requestId);
  });

  it("allows overriding metadata via constructor customMetadata", () => {
    const query = new TestQuery("alice", "corr-1", {
      userId: "user-1",
      tenantId: "tenant-1",
      version: 5,
      requestId: "req-1",
    });
    const metadata = query.getMetadata();

    expect(metadata.userId).toBe("user-1");
    expect(metadata.tenantId).toBe("tenant-1");
    expect(metadata.version).toBe(5);
    expect(metadata.requestId).toBe("req-1");
  });

  it("updates correlationId and causationId", () => {
    const query = new TestQuery("alice", "corr-1");

    query.setCorrelationId("corr-2");
    query.setCausationId("cause-1");

    expect(query.getMetadata().correlationId).toBe("corr-2");
    expect(query.getMetadata().causationId).toBe("cause-1");
  });

  it("updates userId and tenantId", () => {
    const query = new TestQuery("alice", "corr-1");

    query.setUserId("user-2");
    query.setTenantId("tenant-2");

    expect(query.getMetadata().userId).toBe("user-2");
    expect(query.getMetadata().tenantId).toBe("tenant-2");
  });

  it("adds headers and merges them with existing headers", () => {
    const query = new TestQuery("alice", "corr-1");

    query.addHeaders({ a: "1" });
    query.addHeaders({ b: "2" });

    expect(query.getMetadata().headers).toEqual({ a: "1", b: "2" });
  });

  it("adds context entries and merges them with existing context", () => {
    const query = new TestQuery("alice", "corr-1");

    query.addContext("x", 1);
    query.addContext("y", 2);

    expect(query.getMetadata().context).toEqual({ x: 1, y: 2 });
  });
});
