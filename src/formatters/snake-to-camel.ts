function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export class SnakeToCamel {
  static format(text: string): string {
    return text.replace(/_([a-z0-9])/gi, (_, letter: string) => letter.toUpperCase());
  }

  static formatObject<T = any>(obj: T): T {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.formatObject(v)) as any;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (isPlainObject(obj)) {
      return Object.keys(obj).reduce((result, key) => {
        const camelKey = this.format(key);
        (result as any)[camelKey] = this.formatObject((obj as any)[key]);

        return result;
      }, {} as T);
    }

    return obj;
  }
}

export const snakeToCamel = (text: string) => SnakeToCamel.format(text);
