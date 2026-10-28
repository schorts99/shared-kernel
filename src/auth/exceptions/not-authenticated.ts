import { TranslationResolver } from "../../i18n/index.js";

export class NotAuthenticated extends Error {
  constructor(translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("auth.errors.not_authenticated")
      : "Not Authenticated";

    super(message);
    this.name = "NotAuthenticated";
  }
}
