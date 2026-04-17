export function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

export function assertExists<T>(value: T | null | undefined, name = "Value"): T {
  if (value === null || value === undefined) {
    throw new Error(`${name} must exist`);
  }
  return value;
}
