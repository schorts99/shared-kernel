import {
  Criteria,
  LimitNotValid,
  OffsetNotValid,
} from "../../src";

describe("Criteria", () => {
  it("validates limit and offset in the constructor and fromPrimitives", () => {
    expect(() => new Criteria([], [], 0)).toThrow(LimitNotValid);
    expect(() => Criteria.fromPrimitives({ offset: -1 })).toThrow(OffsetNotValid);
  });

  it("isolates filter values from caller mutation", () => {
    const statusList = ["open", "pending"];
    const criteria = Criteria.none().where("status", "IN", statusList);
    statusList.push("closed");
    expect(criteria.filters[0]?.value).toEqual(["open", "pending"]);

    const criteriaPrims = criteria.toPrimitives();
    (criteriaPrims.filters[0]?.value as string[]).push("tampered");
    expect(criteria.filters[0]?.value).toEqual(["open", "pending"]);
  });
});
