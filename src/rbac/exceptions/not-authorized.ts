import { TranslationResolver } from "../../i18n/index.js";

export class NotAuthorized extends Error {
  constructor(translationResolverOrMessage?: TranslationResolver | string) {
    const message =
      typeof translationResolverOrMessage === "string"
        ? translationResolverOrMessage
        : translationResolverOrMessage
          ? translationResolverOrMessage.resolve("rbac.errors.not_authorized")
          : "Not Authorized";

    super(message);
    this.name = "NotAuthorized";
  }
}
