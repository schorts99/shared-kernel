function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (value instanceof Date) {
    return { __type: "Date", value: value.toISOString() };
  }
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    const normalized: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      normalized[key] = canonicalizeValue((value as Record<string, unknown>)[key]);
    }
    return normalized;
  }
  return value;
}

export function unorderedObjectArrayEqual<T extends object>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;

  const normalize = (obj: T) => JSON.stringify(canonicalizeValue(obj));

  const countsA = new Map<string, number>();
  for (const item of a) {
    const key = normalize(item);
    countsA.set(key, (countsA.get(key) ?? 0) + 1);
  }

  for (const item of b) {
    const key = normalize(item);
    const current = countsA.get(key);
    if (!current) {
      return false;
    }
    if (current === 1) {
      countsA.delete(key);
    } else {
      countsA.set(key, current - 1);
    }
  }

  return countsA.size === 0;
}
