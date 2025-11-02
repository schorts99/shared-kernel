import { CommandBus, Command, CommandHandler, CommandNotRegistered } from "../";

export class InMemoryCommandBus implements CommandBus {
  private readonly handlers = new Map<string, CommandHandler>();

  register<C extends Command>(type: string, handler: CommandHandler<C>): void {
    this.handlers.set(type, handler);
  }

  async dispatch<C extends Command>(command: C): Promise<void> {
    const handler = this.handlers.get(command.type);

    if (!handler) {
      throw new CommandNotRegistered(command.type);
    }

    await handler.handle(command);
  }
}
