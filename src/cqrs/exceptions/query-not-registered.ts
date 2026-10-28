import { TranslationResolver } from "../../i18n/index.js";

export class QueryNotRegistered extends Error {
  constructor(query: string, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("cqrs.errors.query_not_registered", { query })
      : `Query Not Registered: ${query}`;

    super(message);
    this.name = "QueryNotRegistered";
  }
}
