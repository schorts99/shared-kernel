import { AbstractCommand } from "../../src/cqrs/command";

describe("AbstractCommand", () => {
  class TestCommand extends AbstractCommand {
    constructor(public readonly payload: string, correlationId = "corr-1", customMetadata?: Partial<any>) {
      super(correlationId, customMetadata);
    }

    getType(): string {
      return "TestCommand";
    }
  }

  it("initializes metadata and generates primitives", () => {
    const command = new TestCommand("alice", "corr-1");
    const metadata = command.getMetadata();
    const primitives = command.toPrimitives();

    expect(metadata.correlationId).toBe("corr-1");
    expect(metadata.createdAt).toBeInstanceOf(Date);
    expect(metadata.id).toBeDefined();
    expect(primitives).toMatchObject({
      type: "TestCommand",
      correlation_id: "corr-1",
      payload: {},
      headers: metadata.headers,
      context: metadata.context,
    });
    expect(primitives.id).toBe(metadata.id);
    expect(primitives.request_id).toBe(metadata.requestId);
  });

  it("allows overriding metadata via constructor customMetadata", () => {
    const command = new TestCommand("alice", "corr-1", {
      userId: "user-1",
      tenantId: "tenant-1",
      version: 5,
      requestId: "req-1",
    });
    const metadata = command.getMetadata();

    expect(metadata.userId).toBe("user-1");
    expect(metadata.tenantId).toBe("tenant-1");
    expect(metadata.version).toBe(5);
    expect(metadata.requestId).toBe("req-1");
  });

  it("updates correlationId and causationId", () => {
    const command = new TestCommand("alice", "corr-1");

    command.setCorrelationId("corr-2");
    command.setCausationId("cause-1");

    expect(command.getMetadata().correlationId).toBe("corr-2");
    expect(command.getMetadata().causationId).toBe("cause-1");
  });

  it("updates userId and tenantId", () => {
    const command = new TestCommand("alice", "corr-1");

    command.setUserId("user-2");
    command.setTenantId("tenant-2");

    expect(command.getMetadata().userId).toBe("user-2");
    expect(command.getMetadata().tenantId).toBe("tenant-2");
  });

  it("adds headers and merges them with existing headers", () => {
    const command = new TestCommand("alice", "corr-1");

    command.addHeaders({ a: "1" });
    command.addHeaders({ b: "2" });

    expect(command.getMetadata().headers).toEqual({ a: "1", b: "2" });
  });

  it("adds context entries and merges them with existing context", () => {
    const command = new TestCommand("alice", "corr-1");

    command.addContext("x", 1);
    command.addContext("y", 2);

    expect(command.getMetadata().context).toEqual({ x: 1, y: 2 });
  });
});
