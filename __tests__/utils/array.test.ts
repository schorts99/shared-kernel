import {
  unorderedObjectArrayEqual,
} from "../../src";

describe("unorderedObjectArrayEqual", () => {
  it("counts duplicates and compares nested keys independent of order", () => {
    expect(
      unorderedObjectArrayEqual(
        [{ id: 1 }, { id: 1 }, { id: 2 }],
        [{ id: 1 }, { id: 2 }, { id: 2 }],
      ),
    ).toBe(false);

    expect(
      unorderedObjectArrayEqual(
        [{ meta: { x: 1, y: 2 } }, { meta: { a: 3, b: 4 } }],
        [{ meta: { b: 4, a: 3 } }, { meta: { y: 2, x: 1 } }],
      ),
    ).toBe(true);
  });
});
