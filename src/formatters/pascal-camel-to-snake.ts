export class PascalCamelToSnake {
  static format(text: string) {
    return text
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
  }
}
