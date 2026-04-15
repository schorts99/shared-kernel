import {
  CommandBus,
  Command,
  CommandHandler,
  CommandNotRegistered,
  CommandBusMiddleware,
  CommandBusContext,
  CommandBusConfig
} from "..";

export class InMemoryCommandBus implements CommandBus {
  private readonly handlers = new Map<string, CommandHandler<Command, unknown>>();
  private readonly middleware: CommandBusMiddleware<true>[] = [];
  private config: CommandBusConfig = {
    enableMetrics: false,
    enableLogging: false,
    autoPublishEvents: false,
    transactional: false,
  };

  register<C extends Command, R = void>(type: string, handler: CommandHandler<C, R>): void {
    if (this.handlers.has(type)) {
      throw new Error(`Handler for command type '${type}' is already registered`);
    }

    this.handlers.set(type, handler);
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

  async dispatch<C extends Command, R = void>(command: C): Promise<R> {
    const handler = this.handlers.get(command.getType()) as CommandHandler<C, R> | undefined;

    if (!handler) {
      throw new CommandNotRegistered(command.getType());
    }

    const startTime = new Date();
    const correlationId = command.getMetadata().correlationId;
    const context: CommandBusContext = {
      correlationId,
      startTime,
      metadata: command.getMetadata() as Record<string, any>,
      config: this.config,
      events: [],
    };

    try {
      for (const mw of this.middleware) {
        if (mw.beforeDispatch) {
          await mw.beforeDispatch(command, context);
        }
      }

      const result = await handler.handle(command, { correlationId, startTime, events: context.events } as any);

      for (const mw of this.middleware) {
        if (mw.afterDispatch) {
          await mw.afterDispatch(command, result, context);
        }
      }

      if (context.events.length > 0) {
        for (const mw of this.middleware) {
          if (mw.onEvents) {
            await mw.onEvents(command, context.events, context);
          }
        }
      }

      return result;
    } catch (error) {
      for (const mw of this.middleware) {
        if (mw.onError) {
          await mw.onError(command, error as Error, context);
        }
      }

      throw error;
    }
  }

  async dispatchMany<C extends Command, R = void>(commands: readonly C[]): Promise<R[]> {
    const results: R[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    for (const command of commands) {
      try {
        results.push(await this.dispatch(command));
      } catch (error) {
        errors.push({ index: results.length, error: error as Error });
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors.map((e) => e.error),
        `${errors.length} command(s) failed during bulk dispatch`
      );
    }

    return results;
  }

  use(middleware: CommandBusMiddleware<true>): void {
    this.middleware.push(middleware);
  }

  removeMiddleware(middleware: CommandBusMiddleware<true>): boolean {
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
    this.config = { ...this.config, ...config };
  }

  clear(): void {
    this.handlers.clear();
    this.middleware.length = 0;
  }
}
