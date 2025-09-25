import { expectTypeOf } from "expect-type";

import { JSONAPIList } from "../../src/json-api";
import { BaseModel } from "../../src/models";

type ExpectedJSONAPIList<EntityAttributes> = {
  data: Array<{
    id: string;
    type: string;
    attributes: Omit<EntityAttributes, "id">;
  }>;
  included?: Array<{
    id: string;
    type: string;
    attributes: Record<string, any>;
  }>;
  meta?: Record<string, any>;
};

describe('JSONAPIList', () => {
  it('should match the expected schema', () => {
    expectTypeOf<JSONAPIList<BaseModel>>().toEqualTypeOf<ExpectedJSONAPIList<BaseModel>>()
  });
});
