import { AggregateRoot } from "../../src/aggregates";
import { DomainEvent } from "../../src/domain-events";
import { ValueObject } from "../../src/value-objects";

// Test value object for aggregate ID
class TestId implements ValueObject {
  readonly valueType = "TestId";
  readonly attributeName = "id";

  constructor(readonly value: string) {}

  get isValid(): boolean {
    return this.value.length > 0;
  }

  equals(other: unknown): boolean {
    return other instanceof TestId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

// Test domain events
class TestCreatedEvent extends DomainEvent<{ name: string }> {
  getEventName(): string {
    return "test.created";
  }
}

class TestUpdatedEvent extends DomainEvent<{ newName: string }> {
  getEventName(): string {
    return "test.updated";
  }
}

// Test aggregate implementation
class TestAggregate extends AggregateRoot<TestId> {
  private _name: string;

  constructor(id: TestId, version: number = 0) {
    super(id, version);
    this._name = "";
  }

  get name(): string {
    return this._name;
  }

  create(name: string): void {
    this._name = name;
    this.recordDomainEvent(new TestCreatedEvent(
      `event-${this.id.toString()}`,
      new Date(),
      "test.created",
      1,
      { name }
    ));
    this.validate();
  }

  updateName(newName: string): void {
    const oldName = this._name;
    this._name = newName;
    this.recordDomainEvent(new TestUpdatedEvent(
      `event-${this.id.toString()}-update`,
      new Date(),
      "test.updated",
      1,
      { newName }
    ));
    this.validate();
  }

  protected validateInvariants(): void {
    if (this._name.length < 2) {
      throw new Error("Name must be at least 2 characters long");
    }
  }

  toPrimitives(): Record<string, any> {
    return {
      id: this.id.toString(),
      name: this._name,
      version: this.version,
    };
  }

  protected restoreFromPrimitives(data: Record<string, any>): void {
    this._name = data.name;
  }
}

describe("AggregateRoot", () => {
  let aggregate: TestAggregate;
  let testId: TestId;

  beforeEach(() => {
    testId = new TestId("test-123");
    aggregate = new TestAggregate(testId);
  });

  describe("construction and identity", () => {
    it("should initialize with ID and version", () => {
      expect(aggregate.id).toBe(testId);
      expect(aggregate.version).toBe(0);
      expect(aggregate.hasUncommittedChanges).toBe(false);
    });

    it("should initialize with specific version", () => {
      const versionedAggregate = new TestAggregate(testId, 5);
      expect(versionedAggregate.version).toBe(5);
    });

    it("should compare equality by ID", () => {
      const sameId = new TestId("test-123");
      const otherAggregate = new TestAggregate(sameId);

      expect(aggregate.equals(otherAggregate)).toBe(true);

      const differentId = new TestId("test-456");
      const differentAggregate = new TestAggregate(differentId);

      expect(aggregate.equals(differentAggregate)).toBe(false);
    });
  });

  describe("domain events", () => {
    it("should record domain events and increment version", () => {
      aggregate.create("test name");

      expect(aggregate.version).toBe(1);
      expect(aggregate.hasUncommittedChanges).toBe(true);

      const events = aggregate.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventName()).toBe("test.created");
      expect(events[0].sequenceNumber).toBe(1);
    });

    it("should assign sequence numbers to multiple events", () => {
      aggregate.create("test name");
      aggregate.updateName("updated name");

      expect(aggregate.version).toBe(2);

      const events = aggregate.pullDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0].sequenceNumber).toBe(1);
      expect(events[1].sequenceNumber).toBe(2);
    });

    it("should clear events when pulled", () => {
      aggregate.create("test name");

      let events = aggregate.pullDomainEvents();
      expect(events).toHaveLength(1);

      events = aggregate.pullDomainEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe("validation", () => {
    it("should validate invariants on state changes", () => {
      expect(() => {
        aggregate.create("x"); // Name too short
      }).toThrow("Name must be at least 2 characters long");
    });

    it("should allow valid state changes", () => {
      expect(() => {
        aggregate.create("valid name");
      }).not.toThrow();

      expect(aggregate.name).toBe("valid name");
    });
  });

  describe("primitives conversion", () => {
    it("should convert to primitives", () => {
      aggregate.create("test name");

      const primitives = aggregate.toPrimitives();
      expect(primitives).toEqual({
        id: "test-123",
        name: "test name",
        version: 1,
      });
    });

    it("should reconstruct from primitives", () => {
      const primitives = {
        id: new TestId("test-456"),
        name: "reconstructed",
        version: 3,
      };

      const reconstructed = TestAggregate.fromPrimitives(primitives);

      expect(reconstructed.id.equals(new TestId("test-456"))).toBe(true);
      expect(reconstructed.name).toBe("reconstructed");
      expect(reconstructed.version).toBe(3);
    });
  });

  describe("snapshot support", () => {
    it("should create and restore from snapshots", () => {
      aggregate.create("snapshot test");

      const snapshot = aggregate.toSnapshot();
      expect(snapshot).toEqual({
        id: testId,
        version: 1,
        data: {
          id: "test-123",
          name: "snapshot test",
          version: 1,
        },
      });

      const restored = TestAggregate.fromSnapshot(snapshot);
      expect(restored.equals(aggregate)).toBe(true);
      expect(restored.name).toBe("snapshot test");
      expect(restored.version).toBe(1);
      expect(restored.hasUncommittedChanges).toBe(false);
    });
  });

  describe("change tracking", () => {
    it("should track uncommitted changes", () => {
      expect(aggregate.hasUncommittedChanges).toBe(false);

      aggregate.create("test");
      expect(aggregate.hasUncommittedChanges).toBe(true);

      aggregate.markChangesCommitted();
      expect(aggregate.hasUncommittedChanges).toBe(false);
    });

    it("should increment version on changes", () => {
      expect(aggregate.version).toBe(0);

      aggregate.create("test");
      expect(aggregate.version).toBe(1);

      aggregate.updateName("updated");
      expect(aggregate.version).toBe(2);
    });
  });

  describe("event ordering", () => {
    it("should maintain event order and sequence numbers", () => {
      // Create initial state
      aggregate.create("initial");

      // Update multiple times
      aggregate.updateName("second");
      aggregate.updateName("third");

      const events = aggregate.pullDomainEvents();

      expect(events).toHaveLength(3);
      expect(events[0].getEventName()).toBe("test.created");
      expect(events[0].sequenceNumber).toBe(1);
      expect((events[0].payload as any).name).toBe("initial");

      expect(events[1].getEventName()).toBe("test.updated");
      expect(events[1].sequenceNumber).toBe(2);
      expect((events[1].payload as any).newName).toBe("second");

      expect(events[2].getEventName()).toBe("test.updated");
      expect(events[2].sequenceNumber).toBe(3);
      expect((events[2].payload as any).newName).toBe("third");
    });
  });
});