import { expectTypeOf } from "expect-type";

import { Operator } from "../../src/criteria";

type ExpectedOperator =
  | "EQUAL"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN_OR_EQUAL"
  | "NOT_EQUAL"
  | "IN"
  | "NOT_IN"
  | "LIKE"
  | "BETWEEN"
  | "GEO_RADIUS";

describe('Operator', () => {
  it('should match the expected type', () => {
    expectTypeOf<Operator>().toEqualTypeOf<ExpectedOperator>();
  });
});
