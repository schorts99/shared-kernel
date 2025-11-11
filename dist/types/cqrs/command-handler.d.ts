import { Command } from "./command";
export interface CommandHandler<C extends Command = Command, R = void> {
    handle(command: C): Promise<R>;
}
//# sourceMappingURL=command-handler.d.ts.map