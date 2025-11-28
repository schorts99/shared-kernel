import { Command } from "./command";
import { MaybePromise } from "../types";

export interface CommandHandler<C extends Command = Command, R = void, IsAsync extends boolean = false> {
  handle(command: C): MaybePromise<IsAsync, R>;
}
