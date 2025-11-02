import { expectTypeOf } from "expect-type";

import { Model } from "../../src/models";

describe("Model", () => {
  it('should have a "id" property of type string or number', () => {
    expectTypeOf<Model>().toHaveProperty("id");
    expectTypeOf<Model['id']>().toEqualTypeOf<string | number>();
  });
});
