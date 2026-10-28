import {
  CommandBus,
  Command,
  CommandHandler,
  CommandHandlerNotRegistered,
  CommandBusMiddleware,
  CommandBusContext,
  CommandBusConfig,
  CommandRegistry,
} from "..";
import { BusRuntime, validateBusConfig } from "../bus-runtime";
import type { Logger } from "../../logger";
import type { EventBus } from "../../event-bus";
import type { UnitOfWork } from "../../unit-of-work";

export interface InMemoryCommandBusDependencies {
  logger?: Logger;
  eventBus?: EventBus;
  createUnitOfWork?: () => UnitOfWork;
}

export class InMemoryCommandBus implements CommandBus {
  private readonly handlers = new Map<
    string,
    CommandHandler<Command, unknown>
  >();

  private readonly middleware: CommandBusMiddleware[] = [];
  private readonly runtime: BusRuntime;
  private readonly dependencies: InMemoryCommandBusDependencies;

  constructor(dependencies: InMemoryCommandBusDependencies = {}) {
    this.dependencies = { ...dependencies };
    this.runtime = new BusRuntime(dependencies.logger);
  }

  getMetrics() {
    return this.runtime.getMetrics();
  }

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
    const config = this.getConfig();
    return this.runtime.run(command.getType(), config, signal => this.execute<C, R>(command, config, signal));
  }

  private async execute<C extends Command, R>(
    command: C,
    config: CommandBusConfig,
    signal: AbortSignal,
  ): Promise<R> {
    const commandType = command.getType();
    const handler = this.handlers.get(commandType) as
      | CommandHandler<C, R>
      | undefined;

    if (!handler) {
      throw new CommandHandlerNotRegistered(commandType);
    }

    const primitives = command.toPrimitives();
    const deserializedCommand =
      CommandRegistry.fromPrimitives(primitives) as C;
    const startTime = new Date();
    const correlationId =
      deserializedCommand.getMetadata().correlationId;
    const context: CommandBusContext = {
      signal,
      correlationId,
      startTime,
      metadata: deserializedCommand.getMetadata() as Record<string, any>,
      config,
      events: [],
    };

    let unitOfWork: UnitOfWork | undefined;
    let committed = false;
    try {
      signal.throwIfAborted();
      if (config.transactional) {
        if (handler.getOptions?.().idempotent) {
          throw new Error("Handler-level idempotency cannot be combined with bus-managed transactions");
        }
        unitOfWork = this.dependencies.createUnitOfWork!();
        await unitOfWork.begin();
      }
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
          metadata: deserializedCommand.getMetadata.bind(deserializedCommand),
          options: handler.getOptions?.() ?? {},
          signal,
          ...(unitOfWork ? { unitOfWork } : {}),
        },
      );
      signal.throwIfAborted();

      for (const mw of this.middleware) {
        if (mw.afterDispatch) {
          await mw.afterDispatch(
            deserializedCommand,
            result,
            context,
          );
        }
      }

      signal.throwIfAborted();
      if (unitOfWork) {
        await unitOfWork.commit();
        committed = true;
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

      if (config.autoPublishEvents && context.events.length > 0) {
        await this.dependencies.eventBus!.publishMany(context.events);
      }

      return result;
    } catch (error) {
      let failure = error;
      if (unitOfWork && !committed) {
        try {
          await unitOfWork.rollback();
        } catch (rollbackError) {
          failure = new AggregateError([error, rollbackError], "Command execution and rollback failed");
        }
      }
      for (const mw of this.middleware) {
        if (mw.onError) {
          await mw.onError(
            deserializedCommand,
            failure instanceof Error ? failure : new Error(String(failure)),
            context,
          );
        }
      }

      throw failure;
    }
  }

  async dispatchMany<C extends Command, R = void>(
    commands: readonly C[],
  ): Promise<R[]> {
    const settled = await Promise.allSettled(commands.map(command => this.dispatch<C, R>(command)));
    const errors = settled.filter(result => result.status === "rejected");
    if (errors.length > 0) {
      throw new AggregateError(
        errors.map(result => result.reason),
        `${errors.length} command(s) failed during bulk dispatch`,
      );
    }

    return settled.map(result => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
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
    const next = {
      ...this.config,
      ...config,
    };
    validateBusConfig(next);
    if (next.transactional && !this.dependencies.createUnitOfWork) {
      throw new Error("transactional requires a createUnitOfWork dependency");
    }
    if (next.autoPublishEvents && !this.dependencies.eventBus) {
      throw new Error("autoPublishEvents requires an eventBus dependency");
    }
    this.config = next;
    this.runtime.setConcurrency(next.maxConcurrency);
  }

  clear(): void {
    this.handlers.clear();
    this.middleware.length = 0;
  }
}
