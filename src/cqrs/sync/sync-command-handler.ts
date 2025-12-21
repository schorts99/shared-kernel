import { Command } from "../command";

export interface SyncCommandHandler<C extends Command = Command, R = void> {
  handle(command: C): R;
}
