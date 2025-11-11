import { CommandBus, Command, CommandHandler, CommandNotRegistered } from "..";

export class AsyncInMemoryCommandBus implements CommandBus {
  private readonly handlers = new Map<string, CommandHandler<Command, unknown>>();

  register<C extends Command, R = void>(type: string, handler: CommandHandler<C, R>): void {
    this.handlers.set(type, handler);
  }

  async dispatch<C extends Command, R = void>(command: C): Promise<R> {
    const handler = this.handlers.get(command.getType()) as CommandHandler<C, R> | undefined;

    if (!handler) {
      throw new CommandNotRegistered(command.getType());
    }

    return handler.handle(command);
  }
}
