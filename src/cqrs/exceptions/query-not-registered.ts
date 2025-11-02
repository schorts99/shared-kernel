import { TranslationResolver } from "../../i18n";

export class QueryNotRegistered extends Error {
  constructor(query: string, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("cqrs.errors.query_not_registered")
      : `Query Not Registered: ${query}`;

    super(message);
  }
}
