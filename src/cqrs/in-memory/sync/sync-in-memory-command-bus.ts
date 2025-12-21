import { CommandBus, Command, SyncCommandHandler, CommandNotRegistered } from "../../index";

export class SyncInMemoryCommandBus implements CommandBus<true> {
  private readonly handlers = new Map<string, SyncCommandHandler<Command, unknown>>();

  register<C extends Command, R = void>(type: string, handler: SyncCommandHandler<C, R>) {
    this.handlers.set(type, handler);
  }

  async dispatch<C extends Command, R = void>(command: C) {
    const handler = this.handlers.get(command.getType()) as SyncCommandHandler<C, R> | undefined;

    if (!handler) {
      throw new CommandNotRegistered(command.getType());
    }

    return handler.handle(command);
  }
}
