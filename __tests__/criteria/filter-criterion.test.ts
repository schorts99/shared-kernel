import { expectTypeOf } from "expect-type";

import { FilterCriterion, Operator } from "../../src/criteria";

type ExpectedFilterCriterion = {
  value: any;
  operator: Operator;
}

describe('FilterCriterion', () => {
  it('should match the expected type', () => {
    expectTypeOf<FilterCriterion>().toEqualTypeOf<ExpectedFilterCriterion>();
  });
});

