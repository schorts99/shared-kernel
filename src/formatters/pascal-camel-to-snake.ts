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

  static formatObject<T = any>(obj: T): T {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.formatObject(v)) as any;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (isPlainObject(obj)) {
      return Object.keys(obj).reduce((result, key) => {
        const snakeKey = this.format(key);
        (result as any)[snakeKey] = this.formatObject((obj as any)[key]);

        return result;
      }, {} as T);
    }

    return obj;
  }
}

export const pascalCamelToSnake = (text: string) => PascalCamelToSnake.format(text);
