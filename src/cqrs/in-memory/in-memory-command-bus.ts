import {
  CommandBus,
  Command,
  CommandHandler,
  CommandNotRegistered,
  CommandBusMiddleware,
  CommandBusContext,
  CommandBusConfig,
  CommandRegistry,
} from "..";

export class InMemoryCommandBus implements CommandBus {
  private readonly handlers = new Map<
    string,
    CommandHandler<Command, unknown>
  >();

  private readonly middleware: CommandBusMiddleware[] = [];

  private config: CommandBusConfig = {
    enableMetrics: false,
    enableLogging: false,
    autoPublishEvents: false,
    transactional: false,
  };

  register<C extends Command, R = void>(
    type: string,
    handler: CommandHandler<C, R>,
  ): void {
    if (this.handlers.has(type)) {
      throw new Error(
        `Handler for command type '${type}' is already registered`,
      );
    }

    this.handlers.set(
      type,
      handler as CommandHandler<Command, unknown>,
    );
  }

  unregister(type: string): boolean {
    return this.handlers.delete(type);
  }

  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  async dispatch<C extends Command, R = void>(
    command: C,
  ): Promise<R> {
    const commandType = command.getType();
    const handler = this.handlers.get(commandType) as
      | CommandHandler<C, R>
      | undefined;

    if (!handler) {
      throw new CommandNotRegistered(commandType);
    }

    const primitives = command.toPrimitives();
    const deserializedCommand =
      CommandRegistry.fromPrimitives(primitives) as C;
    const startTime = new Date();
    const correlationId =
      deserializedCommand.getMetadata().correlationId;
    const context: CommandBusContext = {
      correlationId,
      startTime,
      metadata: deserializedCommand.getMetadata() as Record<string, any>,
      config: this.config,
      events: [],
    };

    try {
      for (const mw of this.middleware) {
        if (mw.beforeDispatch) {
          await mw.beforeDispatch(
            deserializedCommand,
            context,
          );
        }
      }

      const result = await handler.handle(
        deserializedCommand,
        {
          correlationId,
          startTime,
          events: context.events,
        } as any,
      );

      for (const mw of this.middleware) {
        if (mw.afterDispatch) {
          await mw.afterDispatch(
            deserializedCommand,
            result,
            context,
          );
        }
      }

      if (context.events.length > 0) {
        for (const mw of this.middleware) {
          if (mw.onEvents) {
            await mw.onEvents(
              deserializedCommand,
              context.events,
              context,
            );
          }
        }
      }

      return result;
    } catch (error) {
      for (const mw of this.middleware) {
        if (mw.onError) {
          await mw.onError(
            deserializedCommand,
            error as Error,
            context,
          );
        }
      }

      throw error;
    }
  }

  async dispatchMany<C extends Command, R = void>(
    commands: readonly C[],
  ): Promise<R[]> {
    const results: R[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    for (const [index, command] of commands.entries()) {
      try {
        results.push(await this.dispatch<C, R>(command));
      } catch (error) {
        errors.push({
          index,
          error: error as Error,
        });
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors.map((e) => e.error),
        `${errors.length} command(s) failed during bulk dispatch`,
      );
    }

    return results;
  }

  use(middleware: CommandBusMiddleware): void {
    this.middleware.push(middleware);
  }

  removeMiddleware(middleware: CommandBusMiddleware): boolean {
    const index = this.middleware.indexOf(middleware);

    if (index >= 0) {
      this.middleware.splice(index, 1);

      return true;
    }

    return false;
  }

  getConfig(): CommandBusConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<CommandBusConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  clear(): void {
    this.handlers.clear();
    this.middleware.length = 0;
  }
}
