import {
  CommandBus,
  Command,
  CommandHandler,
  CommandHandlerNotRegistered,
  CommandBusMiddleware,
  CommandBusContext,
  CommandBusConfig,
  CommandRegistry,
  CommandPostCommitError,
} from "..";
import { BusRuntime, validateBusConfig } from "../bus-runtime";
import type { BusDispatchOptions, BusCloseOptions } from "../bus-runtime";
import type { Logger } from "../../logger";
import type { EventBus } from "../../event-bus";
import type { UnitOfWork } from "../../unit-of-work";
import { CommitOutcomeUnknownError } from "../../unit-of-work/commit-outcome-unknown-error";
import { DomainEventRegistry } from "../../domain-events";
import type { ExecutionContext, ExecutionContextStorage } from "../../types/execution-context";
import type { IdempotencyExecution, IdempotencyStore, TransactionalIdempotencyAdapter,
  CommittedIdempotencyRecord } from "../../idempotency";

interface IdempotencyFrame {
  active: boolean;
  keys: ReadonlyArray<{ store: IdempotencyStore; key: string }>;
}

export interface InMemoryCommandBusDependencies {
  executionContext?: ExecutionContext;
  logger?: Logger;
  eventBus?: EventBus;
  /** One independent transaction per command, including nested commands. */
  createUnitOfWork?: () => UnitOfWork;
  transactionalIdempotency?: TransactionalIdempotencyAdapter;
}

export class InMemoryCommandBus implements CommandBus {
  private readonly handlers = new Map<
    string,
    CommandHandler<Command, unknown>
  >();

  private readonly middleware: CommandBusMiddleware[] = [];
  private readonly runtime: BusRuntime;
  private readonly dependencies: InMemoryCommandBusDependencies;
  private readonly idempotencyContext: ExecutionContextStorage<IdempotencyFrame> | undefined;

  constructor(dependencies: InMemoryCommandBusDependencies = {}) {
    this.dependencies = { ...dependencies };
    this.runtime = new BusRuntime(dependencies.logger, dependencies.executionContext);
    this.idempotencyContext = dependencies.executionContext?.createStorage<IdempotencyFrame>();
  }

  getMetrics() {
    return this.runtime.getMetrics();
  }

  drain(): Promise<void> { return this.runtime.drain(); }
  close(options?: BusCloseOptions): Promise<void> { return this.runtime.close(options); }

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
    options?: BusDispatchOptions,
  ): Promise<R> {
    const config = this.getConfig();
    return this.runtime.run(command.getType(), config, signal => this.execute<C, R>(command, config, signal), options);
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

    const options = handler.getOptions?.() ?? {};
    let serializedResult: unknown;
    const key = options.idempotent ? handler.getIdempotencyKey?.(deserializedCommand) : null;
    const durable = config.transactional && key != null ? this.dependencies.transactionalIdempotency : undefined;
    const completion = (result: R, committed: boolean, retryable: boolean): IdempotencyExecution<R> => {
      const events = [...context.events];
      const eventMiddleware = this.middleware.filter(mw => mw.onEvents);
      const completionContext = { ...context, events };
      delete completionContext.signal;
      let invalidated = false;
      let middlewareIndex = 0;
      let eventIndex = 0;
      return {
        result,
        complete: async () => {
          try {
            if (config.transactional && !invalidated && options.cache && handler.getInvalidationTags) {
              const tags = handler.getInvalidationTags(deserializedCommand, result);
              if (tags.length > 0) {
                if (!options.cache.deleteByTags) throw new Error("Command cache does not support tag invalidation");
                await options.cache.deleteByTags(tags);
              }
            }
            invalidated = true;
            while (events.length > 0 && middlewareIndex < eventMiddleware.length) {
              await eventMiddleware[middlewareIndex]!.onEvents!(deserializedCommand, events, completionContext);
              middlewareIndex++;
            }
            while (config.autoPublishEvents && eventIndex < events.length) {
              await this.dependencies.eventBus!.publish(events[eventIndex]!);
              eventIndex++;
            }
          } catch (error) {
            if (committed) throw new CommandPostCommitError(error, retryable);
            throw error;
          }
        },
      };
    };
    const recover = (record: CommittedIdempotencyRecord): IdempotencyExecution<R> => {
      serializedResult = record.result;
      context.events = record.events.map(primitives => DomainEventRegistry.fromPrimitives(primitives));
      const result = handler.deserializeResult ? handler.deserializeResult(record.result) : record.result as R;
      return completion(result, true, true);
    };
    const operation = async (serialize = false): Promise<IdempotencyExecution<R>> => {
      let unitOfWork: UnitOfWork | undefined;
      let committed = false;
      let commitAttempted = false;
      let recoveryRecord: CommittedIdempotencyRecord | undefined;
      try {
        signal.throwIfAborted();
        if (config.transactional) {
          unitOfWork = this.dependencies.createUnitOfWork!();
          await unitOfWork.begin();
          if (durable && key != null) {
            const previous = await durable.claim(unitOfWork, key);
            if (previous) {
              committed = true;
              serializedResult = previous.result;
              await unitOfWork.rollback();
              recoveryRecord = previous;
              return recover(previous);
            }
          }
        }
        signal.throwIfAborted();
        for (const mw of this.middleware) {
          await mw.beforeDispatch?.(deserializedCommand, context);
        }

        signal.throwIfAborted();
        const result = await handler.handle(deserializedCommand, {
          correlationId,
          startTime,
          events: context.events,
          metadata: deserializedCommand.getMetadata.bind(deserializedCommand),
          options,
          signal,
          idempotencyManagedByBus: serialize,
          deferCacheInvalidation: config.transactional ?? false,
          ...(unitOfWork ? { unitOfWork } : {}),
        });
        signal.throwIfAborted();

        for (const mw of this.middleware) {
          await mw.afterDispatch?.(deserializedCommand, result, context);
        }

        signal.throwIfAborted();
        if (serialize) serializedResult = handler.serializeResult ? handler.serializeResult(result) : result;
        if (unitOfWork) {
          if (durable && key != null) {
            await durable.record(unitOfWork, key, {
              result: serializedResult,
              events: context.events.map(event => event.toPrimitives()),
            });
          }
          signal.throwIfAborted();
          commitAttempted = true;
          try {
            await unitOfWork.commit();
            committed = true;
          } catch (commitError) {
            if (!durable || key == null) throw new CommitOutcomeUnknownError(commitError, key ?? undefined);
            let resolution;
            try {
              resolution = await durable.resolve(key);
            } catch (resolutionError) {
              throw new CommitOutcomeUnknownError(new AggregateError([commitError, resolutionError]), key);
            }
            if (resolution.status === "unknown") throw new CommitOutcomeUnknownError(commitError, key);
            if (resolution.status === "not-committed") {
              commitAttempted = false;
              throw commitError;
            }
            committed = true;
            recoveryRecord = resolution.record;
            return recover(resolution.record);
          }
        }

        return completion(result, committed, serialize);
      } catch (error) {
        if (committed && serialize) {
          return {
            result: undefined as R,
            complete: async () => {
              if (!recoveryRecord) throw new CommandPostCommitError(error, true);
              try {
                await recover(recoveryRecord).complete?.();
              } catch (recoveryError) {
                throw new CommandPostCommitError(recoveryError, true);
              }
            },
          };
        }
        if (unitOfWork && !committed && !commitAttempted) {
          try {
            await unitOfWork.rollback();
          } catch (rollbackError) {
            throw new AggregateError([error, rollbackError], "Command execution and rollback failed");
          }
        }
        throw error;
      }
    };

    try {
      if (options.idempotent && key === undefined) {
        throw new Error("Bus-managed idempotency requires getIdempotencyKey");
      }
      if (key !== null && key !== undefined) {
        const store = options.idempotencyStore;
        if (!store || !this.idempotencyContext || !handler.validate || !handler.authorize) {
          throw new Error("Bus-managed idempotency requires a store, executionContext, validation, and authorization hooks");
        }
        await handler.validate(deserializedCommand);
        await handler.authorize(deserializedCommand);
        signal.throwIfAborted();
        const parent = this.idempotencyContext.getStore();
        const keys = parent?.active ? parent.keys : [];
        if (keys.some(entry => entry.store === store && entry.key === key)) {
          throw new Error(`Recursive command dispatch for idempotency key '${key}'`);
        }
        const frame: IdempotencyFrame = { active: true, keys: [...keys, { store, key }] };
        try {
          const serialized = await this.runtime.waitFor(this.idempotencyContext.run(frame, () => store.executeWithCompletion(key, async () => {
            const outcome = await operation(true);
            return {
              result: serializedResult,
              ...(outcome.complete ? { complete: outcome.complete } : {}),
            };
          })), config, signal);
          return handler.deserializeResult ? handler.deserializeResult(serialized) : serialized as R;
        } finally {
          frame.active = false;
        }
      }
      const outcome = await operation();
      await outcome.complete?.();
      return outcome.result;
    } catch (error) {
      for (const mw of this.middleware) {
        if (mw.onError) {
          await mw.onError(
            deserializedCommand,
            error instanceof Error ? error : new Error(String(error)),
            context,
          );
        }
      }

      throw error;
    }
  }

  async dispatchMany<C extends Command, R = void>(
    commands: readonly C[],
    options?: BusDispatchOptions,
  ): Promise<R[]> {
    const settled = await Promise.allSettled(commands.map(command => this.dispatch<C, R>(command, options)));
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
    this.runtime.setConcurrency(next.maxConcurrency, next.maxQueueSize);
    this.config = next;
  }

  clear(): void {
    this.handlers.clear();
    this.middleware.length = 0;
  }
}
