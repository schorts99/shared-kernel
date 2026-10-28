import {
  debounce,
} from "../../src";

describe("debounce", () => {
  it("supports flush and pending", () => {
    const calls: string[] = [];
    const debouncedFn = debounce((val: string) => {
      calls.push(val);
    }, 5000);

    expect(debouncedFn.pending()).toBe(false);
    debouncedFn("first");
    debouncedFn("second");
    expect(debouncedFn.pending()).toBe(true);
    expect(calls).toEqual([]);

    debouncedFn.flush();
    expect(debouncedFn.pending()).toBe(false);
    expect(calls).toEqual(["second"]);
  });
});
