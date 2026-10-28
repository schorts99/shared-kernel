import { isPlainObject, randomString } from "../../src";

describe("randomString", () => {
  const hasWebCrypto = typeof globalThis.crypto?.getRandomValues === "function";
  const itWithCrypto = hasWebCrypto ? it : it.skip;

  itWithCrypto("returns alphanumeric strings of the requested length", () => {
    expect(randomString()).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(randomString(0)).toBe("");
    expect(randomString(1)).toMatch(/^[A-Za-z0-9]$/);
    expect(randomString(100_000)).toHaveLength(100_000);
  });

  itWithCrypto("draws from Web Crypto instead of Math.random", () => {
    const mathRandom = jest.spyOn(Math, "random");
    const getRandomValues = jest.spyOn(globalThis.crypto, "getRandomValues");

    try {
      randomString(32);

      expect(mathRandom).not.toHaveBeenCalled();
      expect(getRandomValues).toHaveBeenCalled();
    } finally {
      mathRandom.mockRestore();
      getRandomValues.mockRestore();
    }
  });

  itWithCrypto("discards bytes that would bias the alphabet", () => {
    const getRandomValues = jest
      .spyOn(globalThis.crypto, "getRandomValues")
      .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        const bytes = array as unknown as Uint8Array;
        // 248-255 must be skipped; 0 maps to "A" and 61 maps to "9".
        bytes.fill(255);
        bytes[3] = 0;
        bytes[7] = 61;
        return array;
      });

    try {
      expect(randomString(2)).toBe("A9");
    } finally {
      getRandomValues.mockRestore();
    }
  });

  it("rejects invalid lengths", () => {
    expect(() => randomString(-1)).toThrow(RangeError);
    expect(() => randomString(1.5)).toThrow(RangeError);
    expect(() => randomString(Number.NaN)).toThrow(RangeError);
  });

  it("throws instead of falling back when Web Crypto is unavailable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });

    try {
      expect(() => randomString(8)).toThrow("Web Crypto API");
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, "crypto", descriptor);
      } else {
        delete (globalThis as { crypto?: unknown }).crypto;
      }
    }
  });
});

describe("isPlainObject", () => {
  it("accepts object literals and null-prototype objects", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it("rejects arrays, class instances, built-ins, and primitives", () => {
    class Point {
      constructor(readonly x: number) {}
    }

    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(new Point(1))).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(new Map())).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject("object")).toBe(false);
    expect(isPlainObject(42)).toBe(false);
  });
});
