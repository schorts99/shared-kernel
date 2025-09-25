import { expectTypeOf } from "expect-type";

import { JSONAPISingle } from "../../src/json-api";
import { BaseModel } from "../../src/models";

type ExpectedJSONAPISingle<EntityAttributes> = {
  data: {
    id: string;
    type: string;
    attributes: Omit<EntityAttributes, "id">;
  };
  included?: Array<{
    id: string;
    type: string;
    attributes: Omit<Record<string, any>, "id">;
  }>;
  meta?: Record<string, any>;
};

describe('JSONAPISingle', () => {
  it('should match the expected schema', () => {
    expectTypeOf<JSONAPISingle<BaseModel>>().toEqualTypeOf<ExpectedJSONAPISingle<BaseModel>>()
  });
});
