import { TranslationResolver } from "../../i18n";

export class OffsetNotValid extends Error {
  constructor(offset: number, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("criteria.errors.offset_not_valid", { offset })
      : `Offset Not Valid: ${offset}`;

    super(message);
  }
}
