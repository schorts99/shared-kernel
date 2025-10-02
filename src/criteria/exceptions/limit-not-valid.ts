import { TranslationResolver } from "../../i18n";

export class LimitNotValid extends Error {
  constructor(limit: number, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("criteria.errors.limit_not_valid", { limit })
      : `Limit Not Valid: ${limit}`;

    super(message);
  }
}
