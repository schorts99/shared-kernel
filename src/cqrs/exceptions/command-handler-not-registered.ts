import { TranslationResolver } from "../../i18n/index.js";

export class CommandHandlerNotRegistered extends Error {
  constructor(command: string, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("cqrs.errors.command_handler_not_registered", { command })
      : `Command Handler Not Registered: ${command}`;

    super(message);
    this.name = "CommandHandlerNotRegistered";
  }
}
