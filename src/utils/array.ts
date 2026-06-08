export function unorderedObjectArrayEqual<T extends object>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;

  const normalize = (obj: T) => {
    const sortedKeys = Object.keys(obj).sort();
    const normalized: Record<string, unknown> = {};

    for (const key of sortedKeys) {
      normalized[key] = (obj as any)[key];
    }

    return JSON.stringify(normalized);
  };

  const setA = new Set(a.map(normalize));
  const setB = new Set(b.map(normalize));

  if (setA.size !== setB.size) return false;

  for (const val of setA) {
    if (!setB.has(val)) return false;
  }

  return true;
}
