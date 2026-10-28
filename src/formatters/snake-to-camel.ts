import { isPlainObject } from "../utils/object.js";

export class SnakeToCamel {
  static format(text: string): string {
    const trimmed = text.replace(/^_+/, "").replace(/_+$/, "");
    if (!trimmed) return "";

    const normalized =
      trimmed.includes("_") || trimmed === trimmed.toUpperCase()
        ? trimmed.toLowerCase()
        : `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;

    return normalized.replace(/_+([a-z0-9])/gi, (_, letter: string) => letter.toUpperCase());
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
        const camelKey = this.format(key);
        (result as any)[camelKey] = this.formatObject((obj as any)[key], seen);
      }

      return result;
    }

    return obj;
  }
}

export const snakeToCamel = (text: string) => SnakeToCamel.format(text);
