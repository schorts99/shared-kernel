import { CommandBus, Command, CommandHandler } from "..";
export declare class AsyncInMemoryCommandBus implements CommandBus {
    private readonly handlers;
    register<C extends Command>(type: string, handler: CommandHandler<C>): void;
    dispatch<C extends Command>(command: C): Promise<void>;
}
//# sourceMappingURL=async-in-memory-command-bus.d.ts.map