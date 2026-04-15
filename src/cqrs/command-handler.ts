import { Command } from "./command";
import {
  CommandValidationError,
  CommandAuthorizationError,
  CommandExecutionError,
  CommandMaxRetriesExceeded
} from "./exceptions";

export interface CommandHandlerOptions {
  logging?: boolean;
  metrics?: boolean;
  timeout?: number;
  maxRetries?: number;
  idempotent?: boolean;
  publishEvents?: boolean;
}

export interface CommandHandlerContext {
  metadata: Command["getMetadata"];
  options: CommandHandlerOptions;
  startTime: Date;
  correlationId: string;
  events: any[];
}

export interface CommandHandler<C extends Command = Command, R = void> {
  handle(command: C, context?: CommandHandlerContext): Promise<R>;

  getOptions?(): CommandHandlerOptions;

  validate?(command: C): Promise<void>;

  authorize?(command: C): Promise<void>;

  execute(command: C, context?: CommandHandlerContext): Promise<R>;

  getIdempotencyKey?(command: C): string | null;

  canRetry?(command: C, error: Error): boolean;
}

export abstract class AbstractCommandHandler<C extends Command = Command, R = void>
  implements CommandHandler<C, R> {

  protected readonly options: CommandHandlerOptions;
  
  constructor(options: CommandHandlerOptions = {}) {
    this.options = {
      logging: false,
      metrics: false,
      maxRetries: 0,
      idempotent: false,
      publishEvents: false,
      ...options,
    };
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

    while (retryCount <= (this.options.maxRetries ?? 0)) {
      try {
        await this.validate(command);
        await this.authorize(command);

        if (this.options.idempotent) {
          const idempotencyKey = this.getIdempotencyKey?.(command);
          if (idempotencyKey) {
            // TODO: Check if command was already processed
          }
        }

        const result = await this.execute(command, handlerContext);

        if (this.options.idempotent) {
          const idempotencyKey = this.getIdempotencyKey?.(command);

          if (idempotencyKey) {
            // TODO: Store execution result
          }
        }

        if (this.options.logging) {
          this.logCommand(command, result, startTime);
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        if (retryCount < (this.options.maxRetries ?? 0) && this.canRetry?.(command, lastError)) {
          retryCount++;

          if (this.options.logging) {
            console.warn(`[CommandHandler] ${command.getType()} retry attempt ${retryCount}`, {
              correlationId,
              error: lastError instanceof Error ? lastError.message : String(lastError),
            });
          }
          continue;
        }

        if (retryCount > 0 && retryCount >= (this.options.maxRetries ?? 0)) {
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
            lastError instanceof CommandExecutionError) {
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

  public async validate(_: C): Promise<void> {}

  public async authorize(_: C): Promise<void> {}

  public abstract execute(command: C, context: CommandHandlerContext): Promise<R>;

  getIdempotencyKey(command: C): string | null {
    return `${command.getType()}:${JSON.stringify(command.toPrimitives?.() ?? {})}`;
  }

  canRetry(_: C, error: Error): boolean {
    return error instanceof CommandExecutionError;
  }

  private logCommand(command: C, result: R, startTime: Date): void {
    const duration = Date.now() - startTime.getTime();
    console.log(`[CommandHandler] ${command.getType()} completed in ${duration}ms`, {
      correlationId: command.getMetadata().correlationId,
      userId: command.getMetadata().userId,
    });
  }

  private logError(command: C, error: any, startTime: Date): void {
    const duration = Date.now() - startTime.getTime();

    console.error(`[CommandHandler] ${command.getType()} failed after ${duration}ms`, {
      correlationId: command.getMetadata().correlationId,
      userId: command.getMetadata().userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
