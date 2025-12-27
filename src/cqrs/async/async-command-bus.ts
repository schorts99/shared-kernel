import { Command } from "../command";
import { AsyncCommandHandler } from "./async-command-handler";

export interface AsyncCommandBus {
  register<C extends Command, R = void>(type: string, handler: AsyncCommandHandler<C, R>): void;
  dispatch<C extends Command, R = void>(command: C): Promise<R>;
}
