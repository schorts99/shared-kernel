import {
  AggregateRoot,
  Criteria,
  EntityRegistry,
  UUIDValue,
} from "../../src";
import {
  TestCoordinatesValue,
  TestDateValue,
  TestEmailValue,
  TestSlugValue,
  TestURLValue,
  TestUUIDValue,
} from "../support/fixtures";

describe("Primitives round-trips", () => {
  it("round-trip Criteria, value objects, EntityRegistry, and AggregateRoot", () => {
    const criteria = Criteria.none()
      .where("status", "EQUAL", "active")
      .orderBy("createdAt", "DESC")
      .limitResults(25)
      .offsetResults(2);

    const criteriaPrimitives = criteria.toPrimitives();
    const hydratedCriteria = Criteria.fromPrimitives(criteriaPrimitives);
    expect(hydratedCriteria.toPrimitives()).toEqual(criteriaPrimitives);

    const uuid = TestUUIDValue.fromPrimitives("123e4567-e89b-12d3-a456-426614174000");
    expect(uuid.toPrimitives()).toBe("123e4567-e89b-12d3-a456-426614174000");

    const email = TestEmailValue.fromPrimitives("user@example.com");
    expect(email.toPrimitives()).toBe("user@example.com");

    const slug = TestSlugValue.fromPrimitives("hello-world");
    expect(slug.toPrimitives()).toBe("hello-world");

    const coords = TestCoordinatesValue.fromPrimitives({ latitude: 40.7128, longitude: -74.006 });
    expect(coords.toPrimitives()).toEqual({ latitude: 40.7128, longitude: -74.006 });

    const dateVal = TestDateValue.fromPrimitives("2026-01-01T00:00:00.000Z");
    expect(dateVal.toPrimitives()).toBe("2026-01-01T00:00:00.000Z");

    const urlVal = TestURLValue.fromPrimitives("https://example.com/test");
    expect(urlVal.toPrimitives()).toBe("https://example.com/test");

    class InvoiceAggregate extends AggregateRoot<UUIDValue> {
      public amount: number;

      constructor(id: UUIDValue, amount = 0) {
        super(id);
        this.amount = amount;
      }

      protected override createId(rawId: string | UUIDValue): UUIDValue {
        return rawId instanceof UUIDValue ? rawId : TestUUIDValue.fromPrimitives(rawId);
      }

      toPrimitives(): Record<string, unknown> {
        return { id: this.id.toPrimitives(), amount: this.amount };
      }

      override restoreFromPrimitives(primitives: Record<string, any>): void {
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
