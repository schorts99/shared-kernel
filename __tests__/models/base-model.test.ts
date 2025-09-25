import { describe, it } from "@jest/globals";
import { expectTypeOf } from "expect-type";

import { BaseModel } from "../../src/models";

describe("BaseModel", () => {
  it('should have a "id" property of type string or number', () => {
    expectTypeOf<BaseModel>().toHaveProperty("id");
    expectTypeOf<BaseModel['id']>().toEqualTypeOf<string | number>();
  });
});
