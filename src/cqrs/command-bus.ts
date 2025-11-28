import { Command } from "./command";
import { CommandHandler } from "./command-handler";
import { MaybePromise } from "../types";

export interface CommandBus<IsAsync extends boolean = false> {
  register<C extends Command, R>(type: string, handler: CommandHandler<C, R>): void;
  dispatch<C extends Command, R = void>(command: C): MaybePromise<IsAsync, R>;
}
