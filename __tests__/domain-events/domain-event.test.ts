import { expectTypeOf } from "expect-type";

import { DomainEvent, DomainEventPrimitives } from "../../src/domain-events";

describe('DomainEvent', () => {
  it('should have a "id" property of type string', () => {
    expectTypeOf<DomainEvent>().toHaveProperty("id");
    expectTypeOf<DomainEvent['id']>().toBeString();
  });

  it('should have a "occurredAt" property of type Date', () => {
    expectTypeOf<DomainEvent>().toHaveProperty("occurredAt");
    expectTypeOf<DomainEvent['occurredAt']>().toEqualTypeOf<Date>();
  });

  it('should have a "type" property of type string', () => {
    expectTypeOf<DomainEvent>().toHaveProperty("type");
    expectTypeOf<DomainEvent['type']>().toBeString();
  });

  it('should have a "version" property of type number', () => {
    expectTypeOf<DomainEvent>().toHaveProperty("version");
    expectTypeOf<DomainEvent['version']>().toBeNumber();
  });

  it('should have a "payload" property of customt type', () => {
    type PayloadSchema = {
      name: string;
    };

    expectTypeOf<DomainEvent<PayloadSchema>>().toHaveProperty("payload");
    expectTypeOf<DomainEvent<PayloadSchema>['payload']>().toEqualTypeOf<PayloadSchema>();
  });

  it('should have a "getEventName" method that returns an string', () => {
    expectTypeOf<DomainEvent>().toHaveProperty('getEventName');
    expectTypeOf<DomainEvent['getEventName']>().toBeFunction();
    expectTypeOf<DomainEvent['getEventName']>().returns.toBeString();
  });

  it('should declare a "toPrimitives" method', () => {
    type PayloadSchema = {
      name: string;
    };

    expectTypeOf<DomainEvent>().toHaveProperty('toPrimitives');
    expectTypeOf<DomainEvent['toPrimitives']>().toBeFunction();
    expectTypeOf<DomainEvent<PayloadSchema>['toPrimitives']>().returns.toEqualTypeOf<DomainEventPrimitives<PayloadSchema>>();
  });
});