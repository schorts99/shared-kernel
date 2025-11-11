import { CommandBus, Command, CommandHandler, CommandNotRegistered } from "..";

export class AsyncInMemoryCommandBus implements CommandBus {
  private readonly handlers = new Map<string, CommandHandler<any, any>>();

  register<C extends Command, R>(type: string, handler: CommandHandler<C, R>): void {
    this.handlers.set(type, handler);
  }

  async dispatch<C extends Command, R>(command: C): Promise<R> {
    const handler = this.handlers.get(command.getType()) as CommandHandler<C, R> | undefined;

    if (!handler) {
      throw new CommandNotRegistered(command.getType());
    }

    return handler.handle(command);
  }
}
