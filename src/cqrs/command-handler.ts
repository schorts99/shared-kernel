import { Command } from "./command.js";
import {
  CommandValidationError,
  CommandAuthorizationError,
  CommandExecutionError,
  CommandMaxRetriesExceeded
} from "./exceptions/index.js";
import { Logger } from "../logger/index.js";
import { IdempotencyStore } from "../idempotency/index.js";
import { Cache } from "../cache/index.js";
import type { UnitOfWork } from "../unit-of-work/index.js";
import { CommitOutcomeUnknownError } from "../unit-of-work/commit-outcome-unknown-error.js";
import { CrossDispatchCycleError } from "./bus-runtime.js";
import type { DomainEvent } from "../domain-events/index.js";

export interface CommandHandlerOptions {
  logging?: boolean;
  metrics?: boolean;
  timeout?: number;
  maxRetries?: number;
  idempotent?: boolean;
  publishEvents?: boolean;
  cache?: Cache;
  idempotencyStore?: IdempotencyStore;
  logger?: Logger;
}

export interface CommandHandlerContext {
  metadata: Command["getMetadata"];
  options: CommandHandlerOptions;
  startTime: Date;
  correlationId: string;
  events: DomainEvent[];
  signal?: AbortSignal;
  unitOfWork?: UnitOfWork;
  /** Custom handle implementations must not acquire a second idempotency claim when true. */
  idempotencyManagedByBus?: boolean;
  /** The bus performs invalidation after commit when true. */
  deferCacheInvalidation?: boolean;
}

export interface CommandHandler<C extends Command = Command, R = void> {
  handle(command: C, context?: CommandHandlerContext): Promise<R>;

  getOptions?(): CommandHandlerOptions;

  validate?(command: C): Promise<void>;

  authorize?(command: C): Promise<void>;

  getIdempotencyKey?(command: C): string | null;

  canRetry?(command: C, error: Error): boolean;

  getInvalidationTags?(command: C, result: R): string[];

  serializeResult?(result: R): unknown;

  deserializeResult?(payload: unknown): R;
}

export abstract class AbstractCommandHandler<C extends Command = Command, R = void>
  implements CommandHandler<C, R> {

  protected readonly options: CommandHandlerOptions;
  protected readonly cache?: Cache | undefined;
  protected readonly idempotencyStore?: IdempotencyStore | undefined;
  protected readonly logger?: Logger | undefined;

  constructor(options: CommandHandlerOptions = {}) {
    this.options = {
      logging: false,
      metrics: false,
      maxRetries: 0,
      idempotent: false,
      publishEvents: false,
      ...options,
    };
    this.cache = options.cache;
    this.idempotencyStore = options.idempotencyStore;
    this.logger = options.logger;
  }

  async handle(command: C, context?: CommandHandlerContext): Promise<R> {
    const startTime = new Date();
    const correlationId = command.getMetadata().correlationId;
    const handlerContext: CommandHandlerContext = {
      metadata: command.getMetadata.bind(command),
      options: this.options,
      startTime,
      correlationId,
      events: [],
      ...context,
    };
    let lastError: Error | null = null;
    let retryCount = 0;
    const maxRetries = handlerContext.unitOfWork ? 0 : this.options.maxRetries ?? 0;
    const maxAttempts = maxRetries + 1;

    while (retryCount < maxAttempts) {
      try {
        await this.validate(command);
        await this.authorize(command);

        const execute = async (): Promise<R> => {
          const result = await this.runWithTimeout(command, handlerContext);
          if (!handlerContext.deferCacheInvalidation && this.cache && this.getInvalidationTags) {
            const tags = this.getInvalidationTags(command, result);
            if (tags.length > 0 && this.cache.deleteByTags) {
              await this.cache.deleteByTags(tags);
            }
          }
          return result;
        };
        const idempotencyKey = this.options.idempotent && !handlerContext.idempotencyManagedByBus
          ? this.getIdempotencyKey(command) : null;
        if (idempotencyKey && !this.idempotencyStore) {
          throw new Error("Idempotent commands require an IdempotencyStore");
        }
        const result = idempotencyKey && this.idempotencyStore
          ? this.deserializeResult(await this.idempotencyStore.execute(
            idempotencyKey,
            async () => this.serializeResult(await execute()),
          ))
          : await execute();

        if (this.options.logging) {
          this.logCommand(command, startTime);
        }

        return result;
      } catch (error) {
        if (error instanceof CrossDispatchCycleError || error instanceof CommitOutcomeUnknownError) {
          throw error;
        }
        lastError = error as Error;

        if (retryCount < maxRetries && this.canRetry?.(command, lastError)) {
          retryCount++;

          if (this.options.logging) {
            this.logger?.warn(`[Command ${command.getType()}] retry attempt ${retryCount}`, {
              correlationId,
              retryCount,
              error: lastError instanceof Error ? lastError.message : String(lastError),
            });
          }

          continue;
        }

        if (retryCount > 0 && retryCount >= maxRetries) {
          if (this.options.logging) {
            this.logError(command, lastError, startTime);
          }

          throw new CommandMaxRetriesExceeded(
            `Command execution failed after ${retryCount} retries`,
            retryCount,
            lastError
          );
        }

        if (this.options.logging) {
          this.logError(command, lastError, startTime);
        }

        if (lastError instanceof CommandValidationError ||
          lastError instanceof CommandAuthorizationError ||
          lastError instanceof CommandExecutionError
        ) {
          throw lastError;
        }

        throw new CommandExecutionError(
          `Command execution failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
          "COMMAND_EXECUTION_FAILED",
          { originalError: lastError }
        );
      }
    }

    throw lastError || new CommandExecutionError(
      "Command execution failed with unknown error",
      "COMMAND_EXECUTION_FAILED"
    );
  }

  getOptions(): CommandHandlerOptions {
    return this.options;
  }

  public async validate(_: C): Promise<void> { }

  public async authorize(_: C): Promise<void> { }

  /** Runs the command. Called only by `handle`, after validation and authorization. */
  protected abstract execute(command: C, context: CommandHandlerContext): Promise<R>;

  private async runWithTimeout(command: C, handlerContext: CommandHandlerContext): Promise<R> {
    const timeoutMs = this.options.timeout;
    if (timeoutMs === undefined || timeoutMs <= 0) {
      return await this.execute(command, handlerContext);
    }

    const controller = new AbortController();
    const callerSignal = handlerContext.signal;
    const onCallerAbort = () => controller.abort(callerSignal?.reason);

    if (callerSignal) {
      if (callerSignal.aborted) {
        throw callerSignal.reason ?? new CommandExecutionError("Command aborted", "COMMAND_ABORTED");
      }
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new CommandExecutionError(
          `Command timed out after ${timeoutMs}ms`,
          "COMMAND_TIMEOUT",
        );
        controller.abort(err);
        reject(err);
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        this.execute(command, { ...handlerContext, signal: controller.signal }),
        timeoutPromise,
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }

  getIdempotencyKey(command: C): string | null {
    const primitives = command.toPrimitives?.();
    if (!primitives) {
      return `${command.getType()}:{}`;
    }

    return `${command.getType()}:${JSON.stringify({
      id: primitives.id,
      request_id: primitives.request_id,
      user_id: primitives.user_id,
      tenant_id: primitives.tenant_id,
      version: primitives.version,
      payload: primitives.payload,
    })}`;
  }

  canRetry(_: C, error: Error): boolean {
    return error instanceof CommandExecutionError;
  }

  getInvalidationTags?(_: C, __: R): string[] {
    return [];
  }

  serializeResult(result: R): unknown {
    return result;
  }

  deserializeResult(payload: unknown): R {
    return payload as R;
  }

  private logCommand(command: C, startTime: Date): void {
    const duration = Date.now() - startTime.getTime();

    this.logger?.info(`[Command ${command.getType()}] completed in ${duration}ms`, {
      correlationId: command.getMetadata().correlationId,
      userId: command.getMetadata().userId,
      duration,
    });
  }

  private logError(command: C, error: unknown, startTime: Date): void {
    const duration = Date.now() - startTime.getTime();

    this.logger?.error(`[Command ${command.getType()}] failed after ${duration}ms`, {
      correlationId: command.getMetadata().correlationId,
      userId: command.getMetadata().userId,
      duration,
      error: error instanceof Error ? error.message : String(error),
    }, error instanceof Error ? error : undefined);
  }
}
