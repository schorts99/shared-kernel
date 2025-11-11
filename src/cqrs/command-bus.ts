import { Command } from "./command";
import { CommandHandler } from "./command-handler";

export interface CommandBus {
  register<C extends Command, R>(type: string, handler: CommandHandler<C, R>): void;
  dispatch<C extends Command, R = void>(command: C): Promise<R>;
}
