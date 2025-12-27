import { Command } from "../command";
import { SyncCommandHandler } from "./sync-command-handler";

export interface SyncCommandBus {
  register<C extends Command, R = void>(type: string, handler: SyncCommandHandler<C, R>): void;
  dispatch<C extends Command, R = void>(command: C): R;
}
