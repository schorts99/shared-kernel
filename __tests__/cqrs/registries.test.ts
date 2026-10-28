import {
  CommandRegistry,
  DomainEvent,
  DomainEventRegistry,
  EntityRegistry,
  QueryRegistry,
} from "../../src";
import {
  registerTestMessages,
  TestCommand,
  TestDomainEvent,
  TestQuery,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("Command, Query, and DomainEvent registries", () => {
  it("hydrate messages via static fromPrimitives and registries", () => {
    const cmd = new TestCommand("corr-cmd", { id: "c-1", value: "v-1" }, { tenantId: "tenant-a" });
    const cmdPrimitives = cmd.toPrimitives();
    const hydratedCmd = TestCommand.fromPrimitives(cmdPrimitives);

    expect(hydratedCmd).toBeInstanceOf(TestCommand);
    expect(hydratedCmd.id).toBe(cmd.id);
    expect(hydratedCmd.correlationId).toBe("corr-cmd");
    expect(hydratedCmd.tenantId).toBe("tenant-a");
    expect(hydratedCmd.getPayload()).toEqual({ id: "c-1", value: "v-1" });

    CommandRegistry.register(TestCommand.TYPE, TestCommand);
    const registryCmd = CommandRegistry.fromPrimitives<TestCommand>(cmdPrimitives);
    expect(registryCmd).toBeInstanceOf(TestCommand);
    expect(registryCmd.toPrimitives()).toEqual(cmdPrimitives);

    const qry = new TestQuery("corr-qry", { id: "q-1" }, { tenantId: "tenant-b" });
    const qryPrimitives = qry.toPrimitives();
    const hydratedQry = TestQuery.fromPrimitives(qryPrimitives);

    expect(hydratedQry).toBeInstanceOf(TestQuery);
    expect(hydratedQry.id).toBe(qry.id);
    expect(hydratedQry.correlationId).toBe("corr-qry");
    expect(hydratedQry.tenantId).toBe("tenant-b");
    expect(hydratedQry.getPayload()).toEqual({ id: "q-1" });

    QueryRegistry.register(TestQuery.TYPE, TestQuery);
    const registryQry = QueryRegistry.fromPrimitives<TestQuery>(qryPrimitives);
    expect(registryQry).toBeInstanceOf(TestQuery);
    expect(registryQry.toPrimitives()).toEqual(qryPrimitives);

    const evt = new TestDomainEvent("corr-evt", { id: "e-1" }, { tenantId: "tenant-c", version: 3 });
    const evtPrimitives = evt.toPrimitives();
    const hydratedEvt = TestDomainEvent.fromPrimitives(evtPrimitives);

    expect(hydratedEvt).toBeInstanceOf(TestDomainEvent);
    expect(hydratedEvt.id).toBe(evt.id);
    expect(hydratedEvt.correlationId).toBe("corr-evt");
    expect(hydratedEvt.tenantId).toBe("tenant-c");
    expect(hydratedEvt.version).toBe(3);
    expect(hydratedEvt.getPayload()).toEqual({ id: "e-1" });

    DomainEventRegistry.register(TestDomainEvent.NAME, TestDomainEvent);
    const registryEvt = DomainEventRegistry.fromPrimitives<TestDomainEvent>(evtPrimitives);
    expect(registryEvt).toBeInstanceOf(TestDomainEvent);
    expect(registryEvt.toPrimitives()).toEqual(evtPrimitives);
  });

  it("support has, unregister, and clear", () => {
    CommandRegistry.register("temp.cmd", p => TestCommand.fromPrimitives(p));
    expect(CommandRegistry.has("temp.cmd")).toBe(true);
    expect(CommandRegistry.unregister("temp.cmd")).toBe(true);
    expect(CommandRegistry.has("temp.cmd")).toBe(false);

    QueryRegistry.register("temp.qry", p => TestQuery.fromPrimitives(p));
    expect(QueryRegistry.has("temp.qry")).toBe(true);
    QueryRegistry.clear();
    expect(QueryRegistry.has("temp.qry")).toBe(false);
    QueryRegistry.register(TestQuery.TYPE, TestQuery);

    EntityRegistry.register("temp.entity", () => ({}) as any);
    expect(EntityRegistry.has("temp.entity")).toBe(true);
    expect(EntityRegistry.unregister("temp.entity")).toBe(true);
    expect(EntityRegistry.has("temp.entity")).toBe(false);

    class MinimalRegisteredEvent extends DomainEvent<{ ok: boolean }> {
      getEventName(): string {
        return "temp.event";
      }
      override getPayload() {
        return this.payload;
      }
    }
    DomainEventRegistry.register("temp.event", MinimalRegisteredEvent);
    expect(DomainEventRegistry.has("temp.event")).toBe(true);
    const hydratedMinimal = DomainEventRegistry.fromPrimitives({
      id: "ev-min-1",
      type: "temp.event",
      correlation_id: "corr-min",
      occurred_at: "2026-01-01T00:00:00.000Z",
      payload: { ok: true },
    } as any);
    expect(hydratedMinimal.getPayload()).toEqual({ ok: true });
    DomainEventRegistry.unregister("temp.event");
    expect(DomainEventRegistry.has("temp.event")).toBe(false);
  });
});
