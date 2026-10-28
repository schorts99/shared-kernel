import { TranslationResolver } from "../../i18n/index.js";

export class EntityNotRegistered extends Error {
  constructor(entityName: string, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("entities.errors.entity_not_registered", { entityName })
      : `Entity Not Registered: ${entityName}`;

    super(message);
    this.name = "EntityNotRegistered";
  }
}
