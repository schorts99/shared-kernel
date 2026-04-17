/**
 * Returns a new object containing only the specified keys.
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as any;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result as Pick<T, K>;
}

/**
 * Returns a new object excluding the specified keys.
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj } as any;
  keys.forEach((key) => {
    delete result[key];
  });
  return result as Omit<T, K>;
}

/**
 * Checks if a value is a plain object.
 */
export function isObject(value: any): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
