import { Command } from "./command";
import { CommandHandler } from "./command-handler";
export interface CommandBus {
    register<C extends Command>(type: string, handler: CommandHandler<C>): void;
    dispatch<C extends Command>(command: C): Promise<void>;
}
//# sourceMappingURL=command-bus.d.ts.map