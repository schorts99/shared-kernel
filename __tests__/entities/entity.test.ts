import { Entity } from "../../src/entities/entity";
import { ValueObject } from "../../src/value-objects";
import { Model } from "../../src/models";
import { DomainEvent } from "../../src/domain-events";

class MockId implements ValueObject {
  readonly value: string;
  readonly valueType = "MockId";
  readonly attributeName = "id";
  isValid = true;

  constructor(value: string) {
    this.value = value;
  }

  equals(other: unknown): boolean {
    return other instanceof MockId && other.value === this.value;
  }
}

interface MockModel extends Model {
  id: string;
  name: string;
}

class MockEvent extends DomainEvent {
  getEventName(): string {
    return "mock.event";
  }
}

class TestEntity extends Entity<MockId, MockModel> {
  constructor(id: MockId, public name: string) {
    super(id);
  }

  toPrimitives(): MockModel {
    return {
      id: this.id.value,
      name: this.name,
    };
  }
}

describe("Entity", () => {
  it("should be initialized with an ID", () => {
    const id = new MockId("123");
    const entity = new TestEntity(id, "Test");

    expect(entity.id).toBe(id);
    expect(entity.id.value).toBe("123");
  });

  it("should record and pull domain events", () => {
    const id = new MockId("123");
    const entity = new TestEntity(id, "Test");
    const event1 = new MockEvent("corr-1");
    const event2 = new MockEvent("corr-2");

    entity.recordDomainEvent(event1);
    entity.recordDomainEvent(event2);

    const events = entity.pullDomainEvents();

    expect(events).toHaveLength(2);
    expect(events[0]).toBe(event1);
    expect(events[1]).toBe(event2);
    expect(entity.pullDomainEvents()).toHaveLength(0);
  });

  it("should clear domain events", () => {
    const id = new MockId("123");
    const entity = new TestEntity(id, "Test");
    const event = new MockEvent("corr-1");

    entity.recordDomainEvent(event);
    entity.clearDomainEvents();

    expect(entity.pullDomainEvents()).toHaveLength(0);
  });

  describe("equals", () => {
    it("should return false when comparing with null or undefined", () => {
      const entity = new TestEntity(new MockId("123"), "Test");

      expect(entity.equals(null)).toBe(false);
      expect(entity.equals(undefined)).toBe(false);
    });

    it("should return false when comparing with a non-entity", () => {
      const entity = new TestEntity(new MockId("123"), "Test");

      expect(entity.equals({ id: "123" })).toBe(false);
    });

    it("should return true when comparing with the same instance", () => {
      const entity = new TestEntity(new MockId("123"), "Test");

      expect(entity.equals(entity)).toBe(true);
    });

    it("should return true when comparing two entities with the same ID", () => {
      const entity1 = new TestEntity(new MockId("123"), "Test 1");
      const entity2 = new TestEntity(new MockId("123"), "Test 2");

      expect(entity1.equals(entity2)).toBe(true);
    });

    it("should return false when comparing two entities with different IDs", () => {
      const entity1 = new TestEntity(new MockId("123"), "Test");
      const entity2 = new TestEntity(new MockId("456"), "Test");

      expect(entity1.equals(entity2)).toBe(false);
    });
  });

  it("should implement toPrimitives", () => {
    const id = new MockId("123");
    const entity = new TestEntity(id, "Test Name");
    const primitives = entity.toPrimitives();

    expect(primitives.id).toBe("123");
    expect(primitives.name).toBe("Test Name");
  });
});
