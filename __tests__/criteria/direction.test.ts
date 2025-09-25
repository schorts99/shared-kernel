import { expectTypeOf } from "expect-type";

import { Direction } from "../../src/criteria";

type ExpectedDirection = "ASC" | "DESC";

describe('Direction', () => {
  it('should match the expected type', () => {
    expectTypeOf<Direction>().toEqualTypeOf<ExpectedDirection>();
  });
});
