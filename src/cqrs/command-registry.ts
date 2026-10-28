import { Command } from "./command";
import { CommandMetadata, CommandPrimitives } from "./command-metadata";
import { CommandNotRegistered } from "./exceptions";

export type CommandFactory<C extends Command = Command> = (
  primitives: CommandPrimitives,
) => C;

export type CommandConstructor<C extends Command = Command> =
  | {
      new (...args: any[]): C;
      fromPrimitives(primitives: CommandPrimitives): C;
    }
  | {
      new (
        correlationId: string,
        payload: any,
        metadata?: Partial<CommandMetadata>,
      ): C;
      fromPrimitives?(primitives: CommandPrimitives): C;
    };

export type CommandRegistration<C extends Command = Command> =
  | CommandConstructor<C>
  | CommandFactory<C>;

function isClassConstructor(fn: unknown): fn is new (...args: any[]) => Command {
  return (
    typeof fn === "function" &&
    fn.prototype !== undefined &&
    fn.prototype.constructor === fn
  );
}

export class CommandRegistry {
  private static readonly registry = new Map<string, CommandRegistration>();

  static register<C extends Command = Command>(
    commandType: string,
    constructorOrFactory: CommandRegistration<C>,
  ): void {
    this.registry.set(commandType, constructorOrFactory);
  }

  static fromPrimitives<C extends Command = Command>(primitives: CommandPrimitives): C {
    const registered = this.registry.get(primitives.type);

    if (!registered) {
      throw new CommandNotRegistered(primitives.type);
    }

    if (typeof (registered as { fromPrimitives?: unknown }).fromPrimitives === "function") {
      return (registered as unknown as { fromPrimitives(p: CommandPrimitives): C }).fromPrimitives(
        primitives,
      );
    }

    if (!isClassConstructor(registered)) {
      return (registered as unknown as CommandFactory<C>)(primitives);
    }

    const Constructor = registered as unknown as new (
      correlationId: string,
      payload: any,
      metadata?: Partial<CommandMetadata>,
    ) => C;

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
