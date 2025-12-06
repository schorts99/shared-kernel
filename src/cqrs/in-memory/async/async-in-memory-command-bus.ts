import { CommandBus, Command, CommandHandler, CommandNotRegistered } from "../../index";

export class AsyncInMemoryCommandBus implements CommandBus<true> {
  private readonly handlers = new Map<string, CommandHandler<Command, unknown>>();

  register<C extends Command, R = void>(type: string, handler: CommandHandler<C, R>) {
    this.handlers.set(type, handler);
  }

  async dispatch<C extends Command, R = void>(command: C) {
    const handler = this.handlers.get(command.getType()) as CommandHandler<C, R> | undefined;

    if (!handler) {
      throw new CommandNotRegistered(command.getType());
    }

    return handler.handle(command);
  }
}
