import { Command } from "../command";

export interface AsyncCommandHandler<C extends Command = Command, R = void> {
  handle(command: C): Promise<R>;
}
