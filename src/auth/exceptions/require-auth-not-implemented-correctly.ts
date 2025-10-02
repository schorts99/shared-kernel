import { TranslationResolver } from "../../i18n";

export class RequireAuthNotImplementedCorrectly extends Error {
  constructor(translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("auth.errors.require_auth_not_implemented_correctly")
      : "RequireAuth decorator not implemented correctly";

    super(message);
  }
}
