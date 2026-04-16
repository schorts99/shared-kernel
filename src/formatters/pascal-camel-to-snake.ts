export class PascalCamelToSnake {
  static format(text: string): string {
    return text
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
  }

  static formatObject<T = any>(obj: T): T {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.formatObject(v)) as any;
    }

    if (obj !== null && typeof obj === 'object') {
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
