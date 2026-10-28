import {
  AggregateRoot,
  DomainEvent,
  Entity,
  UUIDValue,
} from "../../src";
import {
  registerTestMessages,
  TestDomainEvent,
  TestUUIDValue,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("Entity and AggregateRoot", () => {
  it("compare by type and ID and assign exact event sequence numbers", () => {
    const sharedUuid = new TestUUIDValue("123e4567-e89b-12d3-a456-426614174000");

    class UserEntity extends Entity<UUIDValue, { id: string }> {
      toPrimitives() {
        return { id: this.id.value };
      }
    }
    class OrderEntity extends Entity<UUIDValue, { id: string }> {
      toPrimitives() {
        return { id: this.id.value };
      }
    }

    const userEnt = new UserEntity(sharedUuid);
    const userEnt2 = new UserEntity(sharedUuid);
    const orderEnt = new OrderEntity(sharedUuid);

    expect(userEnt.equals(userEnt2)).toBe(true);
    expect(userEnt.equals(orderEnt)).toBe(false);

    class OrderAggregate extends AggregateRoot<UUIDValue> {
      touchWithoutEvent(): void {
        this.incrementVersion();
      }
      emit(event: DomainEvent): void {
        this.recordDomainEvent(event);
      }
      toPrimitives() {
        return { id: this.id.value };
      }
    }
    class InvoiceAggregate extends AggregateRoot<UUIDValue> {
      toPrimitives() {
        return { id: this.id.value };
      }
    }

    const orderAgg = new OrderAggregate(sharedUuid, 0);
    const invoiceAgg = new InvoiceAggregate(sharedUuid, 0);

    expect(orderAgg.equals(null)).toBe(false);
    expect(orderAgg.equals(invoiceAgg)).toBe(false);
    expect(orderAgg.equals(new OrderAggregate(sharedUuid, 5))).toBe(true);

    orderAgg.emit(new TestDomainEvent("c-1", { id: "1" }, { id: "ev-1" })); // version 1, seq 1
    orderAgg.touchWithoutEvent(); // version 2
    orderAgg.emit(new TestDomainEvent("c-1", { id: "2" }, { id: "ev-2" })); // version 3, seq 3

    const pulled = orderAgg.pullDomainEvents();
    expect(pulled.map(e => e.sequenceNumber)).toEqual([1, 3]);

    orderAgg.emit(new TestDomainEvent("c-1", { id: "3" }, { id: "ev-3" })); // version 4
    expect(orderAgg.version).toBe(4);
    orderAgg.clearDomainEvents();
    expect(orderAgg.version).toBe(3);
  });
});
