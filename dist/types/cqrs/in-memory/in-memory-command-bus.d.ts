import { CommandBus, Command, CommandHandler } from "../";
export declare class InMemoryCommandBus implements CommandBus {
    private readonly handlers;
    register<C extends Command>(type: string, handler: CommandHandler<C>): void;
    dispatch<C extends Command>(command: C): Promise<void>;
}
//# sourceMappingURL=in-memory-command-bus.d.ts.map