import { describe, it } from "@jest/globals";
import { expectTypeOf } from "expect-type";

import { DomainEventPrimitives } from "../../src/domain-events";

describe("DomainEventPrimitives", () => {
  it('should have a "id" property of type string', () => {
    expectTypeOf<DomainEventPrimitives>().toHaveProperty('id');
    expectTypeOf<DomainEventPrimitives['id']>().toBeString();
  });

  it('should have a "occurred_at" property of type string', () => {
    expectTypeOf<DomainEventPrimitives>().toHaveProperty('occurred_at');
    expectTypeOf<DomainEventPrimitives['occurred_at']>().toBeString();
  });

  it('should have a "type" property of type string', () => {
    expectTypeOf<DomainEventPrimitives>().toHaveProperty('type');
    expectTypeOf<DomainEventPrimitives['type']>().toBeString();
  });

  it('should have a "version" property of type number', () => {
    expectTypeOf<DomainEventPrimitives>().toHaveProperty('version');
    expectTypeOf<DomainEventPrimitives['version']>().toBeNumber();
  });

  it('should have a "payload" property of type number', () => {
    type PayloadSchema = {
      name: string;
    };

    expectTypeOf<DomainEventPrimitives<PayloadSchema>>().toHaveProperty('payload');
    expectTypeOf<DomainEventPrimitives<PayloadSchema>['payload']>().toEqualTypeOf<PayloadSchema>();
  });
});
