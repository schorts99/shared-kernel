export class SnakeToCamel {
  static format(text: string): string {
    return text.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  }

  static formatObject<T = any>(obj: T): T {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.formatObject(v)) as any;
    }

    if (obj !== null && typeof obj === "object") {
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
