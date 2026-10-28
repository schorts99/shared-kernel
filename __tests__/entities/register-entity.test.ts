import {
  asResource,
  Entity,
  EntityRegistry,
  RegisterEntity,
  StaticRBACPolicy,
} from "../../src";
import { TestUUIDValue } from "../support/fixtures";

describe("RegisterEntity", () => {
  afterEach(() => {
    EntityRegistry.unregister("decorated.order");
  });

  it("registers the decorated class so EntityRegistry can rebuild it", () => {
    @RegisterEntity("decorated.order")
    class DecoratedOrder extends Entity<TestUUIDValue, { id: string; total: number }> {
      constructor(id: TestUUIDValue, public total = 0) {
        super(id);
      }

      protected override createId(rawId: string): TestUUIDValue {
        return new TestUUIDValue(rawId);
      }

      toPrimitives() {
        return { id: this.id.value, total: this.total };
      }

      protected override restoreFromPrimitives(data: { total: number }): void {
        this.total = data.total;
      }
    }

    expect(EntityRegistry.has("decorated.order")).toBe(true);

    const restored = EntityRegistry.fromPrimitives<DecoratedOrder>("decorated.order", {
      id: "123e4567-e89b-12d3-a456-426614174000",
      total: 42,
    });

    expect(restored).toBeInstanceOf(DecoratedOrder);
    expect(restored.total).toBe(42);
    expect(restored.id.value).toBe("123e4567-e89b-12d3-a456-426614174000");
  });
});

describe("asResource", () => {
  it("wraps a resource name for RBAC checks", () => {
    const policy = new StaticRBACPolicy({ viewer: [{ resource: "orders", action: "read" }] });

    expect(asResource("orders")).toEqual({ name: "orders" });
    expect(policy.can("viewer", "read", asResource("orders"))).toBe(true);
    expect(policy.can("viewer", "read", asResource("invoices"))).toBe(false);
  });
});
