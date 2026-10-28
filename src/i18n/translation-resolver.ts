export interface TranslationResolver {
  resolve(key: string, params?: Record<string, unknown>): string;
}
