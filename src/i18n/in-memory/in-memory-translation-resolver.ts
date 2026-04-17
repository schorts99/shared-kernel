import { TranslationResolver } from "../translation-resolver";

export class InMemoryTranslationResolver implements TranslationResolver {
  constructor(private readonly translations: Record<string, string> = {}) { }

  resolve(key: string, params?: Record<string, any>): string {
    let message = this.translations[key] || key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        message = message.replace(`{${k}}`, String(v));
      });
    }

    return message;
  }
}

export class CompositeTranslationResolver implements TranslationResolver {
  constructor(private readonly resolvers: TranslationResolver[]) { }

  resolve(key: string, params?: Record<string, any>): string {
    for (const resolver of this.resolvers) {
      const result = resolver.resolve(key, params);
      if (result !== key) {
        return result;
      }
    }

    return key;
  }
}
