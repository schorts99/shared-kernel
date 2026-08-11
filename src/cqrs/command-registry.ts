import { Command } from "./command";
import { CommandMetadata, CommandPrimitives } from "./command-metadata";
import { CommandNotRegistered } from "./exceptions";

export type CommandConstructor = {
  new (
    correlationId: string,
    payload: any,
    metadata?: Partial<CommandMetadata>,
  ): Command;
};

export class CommandRegistry {
  private static readonly registry = new Map<string, CommandConstructor>();

  static register(
    commandType: string,
    constructor: CommandConstructor,
  ): void {
    this.registry.set(commandType, constructor);
  }

  static fromPrimitives(primitives: CommandPrimitives): Command {
    const Constructor = this.registry.get(primitives.type);

    if (!Constructor) {
      throw new CommandNotRegistered(primitives.type);
    }

    return new Constructor(
      primitives.correlation_id,
      primitives.payload,
      {
        id: primitives.id,
        createdAt: new Date(primitives.created_at),
        correlationId: primitives.correlation_id,
        causationId: primitives.causation_id,
        requestId: primitives.request_id,
        version: primitives.version,
        userId: primitives.user_id,
        tenantId: primitives.tenant_id,
        headers: primitives.headers,
        context: primitives.context,
      },
    );
  }
}

export function CommandMapping(commandType: string) {
  return function (constructor: CommandConstructor) {
    CommandRegistry.register(commandType, constructor);
  };
}
