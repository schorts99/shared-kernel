import { TranslationResolver } from "../../i18n";

export class QueryHandlerNotRegistered extends Error {
  constructor(query: string, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("cqrs.errors.query_handler_not_registered")
      : `Query Handler Not Registered: ${query}`;

    super(message);
  }
}
