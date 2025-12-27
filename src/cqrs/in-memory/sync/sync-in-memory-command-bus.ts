import { SyncCommandBus, Command, SyncCommandHandler, CommandNotRegistered } from "../../index";

export class SyncInMemoryCommandBus implements SyncCommandBus {
  private readonly handlers = new Map<string, SyncCommandHandler<Command, unknown>>();

  register<C extends Command, R = void>(type: string, handler: SyncCommandHandler<C, R>) {
    this.handlers.set(type, handler);
  }

  dispatch<C extends Command, R = void>(command: C) {
    const handler = this.handlers.get(command.getType()) as SyncCommandHandler<C, R> | undefined;

    if (!handler) {
      throw new CommandNotRegistered(command.getType());
    }

    return handler.handle(command);
  }
}
