import { AsyncCommandBus, Command, AsyncCommandHandler, CommandNotRegistered } from "../..";

export class AsyncInMemoryCommandBus implements AsyncCommandBus {
  private readonly handlers = new Map<string, AsyncCommandHandler<Command, unknown>>();

  register<C extends Command, R = void>(type: string, handler: AsyncCommandHandler<C, R>) {
    this.handlers.set(type, handler);
  }

  async dispatch<C extends Command, R = void>(command: C) {
    const handler = this.handlers.get(command.getType()) as AsyncCommandHandler<C, R> | undefined;

    if (!handler) {
      throw new CommandNotRegistered(command.getType());
    }

    return handler.handle(command);
  }
}
