import { expectTypeOf } from "expect-type";

import { Entity } from "../../src/entities";
import { ValueObject, UUIDValue } from "../../src/value-objects";
import { DomainEvent, DomainEventPrimitives } from "../../src/domain-events";

type Model = {
  id: string;
  name: string;
};

class TestDomainEvent extends DomainEvent {
  static eventName = "shared.v1.tests.test_domain";

  toPrimitives(): DomainEventPrimitives<{}> {
    return {
      id: this.id,
      occurred_at: this.occurredAt.toString(),
      payload: this.payload,
      type: this.type,
      version: this.version,
    };
  }
 
  getEventName() {
    return TestDomainEvent.eventName;
  }
}

class IDValue extends UUIDValue {
  readonly attributeName = "ID";
}

class TestEntity extends Entity<IDValue, Model> {
  toPrimitives(): Model {
    return {
      id: this.id.toString(),
      name: "test",
    };
  }
}

describe('Entity', () => {
  it('should have a "id" property of type string', () => {
    expectTypeOf<Entity<IDValue, Model>>().toHaveProperty("id");
    expectTypeOf<Entity<IDValue, Model>["id"]>().toEqualTypeOf<IDValue>();
  });

  it('should have a private "domainEvents" property of type Array<DomainEvent>', () => {
    expectTypeOf<Entity<IDValue, Model>["domainEvents"]>().toEqualTypeOf<DomainEvent[]>();
  });

  describe('#pullDomainEvents', () => {
    let testEntity: TestEntity;

    beforeEach(() => {
      testEntity = new TestEntity(new IDValue(""))
    });

    it('should return an array of DomainEvent', () => {
      const domainEvents = testEntity.pullDomainEvents();

      expectTypeOf<typeof domainEvents>().toEqualTypeOf<DomainEvent[]>();
    });

    it('should return the record domain events', () => {
      const testDomainEvent = new TestDomainEvent(
        "",
        new Date(),
        "Test",
        1,
        {},
      );

      testEntity.recordDomainEvent(testDomainEvent);

      const domainEvents = testEntity.pullDomainEvents();
      const expectedDomainEvents = [testDomainEvent];

      expect(domainEvents).toEqual(expectedDomainEvents);
    });
  });

  describe('#recordDomainEvent', () => {
    let testEntity: TestEntity;

    beforeEach(() => {
      testEntity = new TestEntity(new IDValue(""))
    });

    it('should record a domain events', () => {
      const testDomainEvent = new TestDomainEvent(
        "",
        new Date(),
        "Test",
        1,
        {},
      );

      testEntity.recordDomainEvent(testDomainEvent);

      const domainEvents = testEntity.pullDomainEvents();
      const expectedDomainEvents = [testDomainEvent];

      expect(domainEvents).toEqual(expectedDomainEvents);
    });
  });

  it('should declare a "toPrimitives" method', () => {
    expectTypeOf<Entity<IDValue, Model>>().toHaveProperty('toPrimitives');
    expectTypeOf<Entity<IDValue, Model>['toPrimitives']>().toBeFunction();
    expectTypeOf<Entity<IDValue, Model>['toPrimitives']>().returns.toEqualTypeOf<Model>();
  });
});
