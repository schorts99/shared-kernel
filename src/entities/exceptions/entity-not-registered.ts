import { TranslationResolver } from "../../i18n";

export class EntityNotRegistered extends Error {
  constructor(entityName: string, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("entities.errors.entity_not_registered")
      : `Entity Not Registered: ${entityName}`;

    super(message);
  }
}
