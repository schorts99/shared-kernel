import {
  AggregateRoot,
  CommandRegistry,
  CoordinatesValue,
  Criteria,
  DateValue,
  DomainEvent,
  DomainEventRegistry,
  EmailValue,
  EntityRegistry,
  QueryRegistry,
  SlugValue,
  URLValue,
  UUIDValue,
} from "../src";
import {
  registerTestMessages,
  TestCommand,
  TestQuery,
  TestDomainEvent,
} from "./support/fixtures";

beforeAll(registerTestMessages);

describe("5. fromPrimitives and toPrimitives across Domain Building Blocks", () => {
  it("hydrates Command, Query, and DomainEvent via static fromPrimitives and registries", () => {
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

  it("supports Criteria, ValueObjects, EntityRegistry, and AggregateRoot fromPrimitives/toPrimitives", () => {
    const criteria = Criteria.none()
      .where("status", "=", "active")
      .orderBy("createdAt", "DESC")
      .limitResults(25)
      .offsetResults(2);

    const criteriaPrimitives = criteria.toPrimitives();
    const hydratedCriteria = Criteria.fromPrimitives(criteriaPrimitives);
    expect(hydratedCriteria.toPrimitives()).toEqual(criteriaPrimitives);

    const uuid = UUIDValue.fromPrimitives("123e4567-e89b-12d3-a456-426614174000");
    expect(uuid.toPrimitives()).toBe("123e4567-e89b-12d3-a456-426614174000");

    const email = EmailValue.fromPrimitives("user@example.com");
    expect(email.toPrimitives()).toBe("user@example.com");

    const slug = SlugValue.fromPrimitives("hello-world");
    expect(slug.toPrimitives()).toBe("hello-world");

    const coords = CoordinatesValue.fromPrimitives({ latitude: 40.7128, longitude: -74.006 });
    expect(coords.toPrimitives()).toEqual({ latitude: 40.7128, longitude: -74.006 });

    const dateVal = DateValue.fromPrimitives("2026-01-01T00:00:00.000Z");
    expect(dateVal.toPrimitives()).toBe("2026-01-01T00:00:00.000Z");

    const urlVal = URLValue.fromPrimitives("https://example.com/test");
    expect(urlVal.toPrimitives()).toBe("https://example.com/test");

    class InvoiceAggregate extends AggregateRoot<UUIDValue> {
      public amount: number;

      constructor(id: UUIDValue, amount = 0) {
        super(id);
        this.amount = amount;
      }

      protected createId(rawId: string | UUIDValue): UUIDValue {
        return rawId instanceof UUIDValue ? rawId : UUIDValue.fromPrimitives(rawId);
      }

      toPrimitives(): Record<string, unknown> {
        return { id: this.id.toPrimitives(), amount: this.amount };
      }

      restoreFromPrimitives(primitives: Record<string, any>): void {
        this.amount = Number(primitives.amount);
      }
    }

    const hydratedAggregate = InvoiceAggregate.fromPrimitives({
      id: "123e4567-e89b-12d3-a456-426614174000",
      amount: 450,
    });

    expect(hydratedAggregate).toBeInstanceOf(InvoiceAggregate);
    expect(hydratedAggregate.id.toPrimitives()).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(hydratedAggregate.amount).toBe(450);

    EntityRegistry.register("InvoiceAggregate", InvoiceAggregate);
    const registryAggregate = EntityRegistry.fromPrimitives<InvoiceAggregate>("InvoiceAggregate", {
      id: "123e4567-e89b-12d3-a456-426614174000",
      amount: 900,
    });
    expect(registryAggregate).toBeInstanceOf(InvoiceAggregate);
    expect(registryAggregate.amount).toBe(900);
  });
});
