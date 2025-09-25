import { expectTypeOf } from "expect-type";

import { Order } from "../../src/criteria";

type ExpectedOrder = {
  field: string;
  direction: "ASC" | "DESC" | "NONE";
}

describe('Order', () => {
  it('should match the expected type', () => {
    expectTypeOf<Order>().toEqualTypeOf<ExpectedOrder>();
  });
});
