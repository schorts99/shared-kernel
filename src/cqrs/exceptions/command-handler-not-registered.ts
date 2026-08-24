import { TranslationResolver } from "../../i18n";

export class CommandHandlerNotRegistered extends Error {
  constructor(command: string, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("cqrs.errors.command_handler_not_registered")
      : `Command Handler Not Registered: ${command}`;

    super(message);
  }
}
