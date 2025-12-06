import { CommandBus, Command, CommandHandler } from "../../index";
export declare class AsyncInMemoryCommandBus implements CommandBus<true> {
    private readonly handlers;
    register<C extends Command, R = void>(type: string, handler: CommandHandler<C, R>): void;
    dispatch<C extends Command, R = void>(command: C): Promise<R>;
}
//# sourceMappingURL=async-in-memory-command-bus.d.ts.map