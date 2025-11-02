import { Command } from "./command";
export interface CommandHandler<C extends Command = Command> {
    handle(command: C): Promise<void>;
}
//# sourceMappingURL=command-handler.d.ts.map