import { TranslationResolver } from "../../i18n";

export class CommandNotRegistered extends Error {
  constructor(command: string, translationResolver?: TranslationResolver) {
    const message = translationResolver
      ? translationResolver.resolve("cqrs.errors.command_not_registered", { command })
      : `Command Not Registered: ${command}`;

    super(message);
    this.name = "CommandNotRegistered";
  }
}
