import { Command } from "./command";

export interface CommandBus {
  dispatch<C extends Command>(command: C): Promise<void>;
}
