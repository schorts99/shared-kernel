import { expectTypeOf } from "expect-type";

import { Message } from "../../src/messages";

type MessagePrimitives = {
  id: string;
};

describe("Message", () => {
  it('should declare a "toPrimitives" method', () => {
    expectTypeOf<Message>().toHaveProperty('toPrimitives');
    expectTypeOf<Message['toPrimitives']>().toBeFunction();
    expectTypeOf<Message<MessagePrimitives>['toPrimitives']>().returns.toEqualTypeOf<MessagePrimitives>();
  });
});

