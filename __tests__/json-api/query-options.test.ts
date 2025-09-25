import { expectTypeOf } from "expect-type";

import { QueryOptions } from "../../src/json-api";

type ExpectedQueryOptions = Partial<{
  include: string[];
  filter: Record<string, string | number | boolean | Array<string | number>>;
  sort: string | string[];
  page: Partial<{ offset: number; limit: number }>;
}>;

describe('QueryOptions', () => {
  it('should match the expected schema', () => {
    expectTypeOf<QueryOptions>().toEqualTypeOf<ExpectedQueryOptions>();
  });
});
