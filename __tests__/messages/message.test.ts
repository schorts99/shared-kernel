import { describe, it } from "@jest/globals";
import { expectTypeOf } from "expect-type";

import { Message } from "../../src/messages";

describe("Message", () => {
  it('should declare a "toPrimitives" method', () => {
    expectTypeOf<Message>().toHaveProperty('toPrimitives');
    expectTypeOf<Message['toPrimitives']>().toBeFunction();
    expectTypeOf<Message<{ id: string }>['toPrimitives']>().returns.toEqualTypeOf<{ id: string }>();
  });
});

