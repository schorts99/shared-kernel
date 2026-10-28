function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export class PascalCamelToSnake {
  static format(text: string): string {
    return text
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      .toLowerCase();
  }

  static formatObject<T = any>(obj: T, seen: WeakMap<object, any> = new WeakMap()): T {
    if (obj !== null && typeof obj === "object" && seen.has(obj as object)) {
      return seen.get(obj as object);
    }

    if (Array.isArray(obj)) {
      const result: any[] = [];
      seen.set(obj, result);
      for (const v of obj) {
        result.push(this.formatObject(v, seen));
      }
      return result as any;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (isPlainObject(obj)) {
      const result = {} as T;
      seen.set(obj, result);
      for (const key of Object.keys(obj)) {
        const snakeKey = this.format(key);
        (result as any)[snakeKey] = this.formatObject((obj as any)[key], seen);
      }

      return result;
    }

    return obj;
  }
}

export const pascalCamelToSnake = (text: string) => PascalCamelToSnake.format(text);
