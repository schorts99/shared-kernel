import { Command } from "./command";
import { CommandHandler } from "./command-handler";

export interface CommandBusMiddleware {
  beforeDispatch?<C extends Command>(
    command: C,
    context: CommandBusContext
  ): Promise<void>;

  afterDispatch?<C extends Command, R = void>(
    command: C,
    result: R,
    context: CommandBusContext
  ): Promise<void>;

  onError?<C extends Command>(
    command: C,
    error: Error,
    context: CommandBusContext
  ): Promise<void>;

  onEvents?<C extends Command>(
    command: C,
    events: any[],
    context: CommandBusContext
  ): Promise<void>;
}

export interface CommandBusContext {
  correlationId: string;
  startTime: Date;
  metadata: Record<string, any>;
  config: CommandBusConfig;
  events: any[];
}

export interface CommandBusConfig {
  enableMetrics?: boolean;
  enableLogging?: boolean;
  timeout?: number;
  maxConcurrency?: number;
  autoPublishEvents?: boolean;
  transactional?: boolean;
}

export interface CommandBus {
  register<C extends Command, R = void>(
    type: string,
    handler: CommandHandler<C, R>
  ): void;

  unregister(type: string): boolean;

  hasHandler(type: string): boolean;

  getRegisteredTypes(): string[];

  dispatch<C extends Command, R = void>(command: C): Promise<R>;

  dispatchMany<C extends Command, R = void>(
    commands: readonly C[]
  ): Promise<R[]>;

  use(middleware: CommandBusMiddleware): void;

  removeMiddleware(middleware: CommandBusMiddleware): boolean;

  getConfig(): CommandBusConfig;

  setConfig(config: Partial<CommandBusConfig>): void;

  clear(): void;
}
