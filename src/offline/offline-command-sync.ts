import {
  Command,
  CommandBus,
  CommandPrimitives,
  CommandRegistry,
} from "../cqrs/index.js";
import { OfflineStore } from "./offline-store.js";

export interface OfflineCommandSyncOptions<T = CommandPrimitives> {
  hydrateCommand?: (payload: T) => Command;
  stopOnError?: boolean;
  onError?: (error: Error, entry: { key: string; payload: T }) => void;
}

export class OfflineCommandSync<T = CommandPrimitives> {
  private readonly hydrateCommand: (payload: T) => Command;
  private readonly stopOnError: boolean;
  private readonly onError?: ((error: Error, entry: { key: string; payload: T }) => void) | undefined;
  private syncQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: OfflineStore<T>,
    private readonly commandBus: CommandBus,
    options: OfflineCommandSyncOptions<T> = {},
  ) {
    this.hydrateCommand =
      options.hydrateCommand ??
      ((payload: T) => CommandRegistry.fromPrimitives(payload as unknown as CommandPrimitives));
    this.stopOnError = options.stopOnError ?? false;
    this.onError = options.onError;
  }

  async enqueueCommand(command: Command, key = command.toPrimitives().id): Promise<void> {
    await this.store.enqueue(key, command.toPrimitives() as unknown as T);
  }

  async sync(): Promise<{ processed: number; failed: number }> {
    const run = this.syncQueue.then(() => this.performSync());
    this.syncQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async performSync(): Promise<{ processed: number; failed: number }> {
    const items = await this.store.list();
    let processed = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const command = this.hydrateCommand(item.payload);
        await this.commandBus.dispatch(command);
        await this.store.dequeue(item.key);
        processed++;
      } catch (rawError) {
        failed++;
        const error = rawError instanceof Error ? rawError : new Error(String(rawError));
        this.onError?.(error, item);
        if (this.stopOnError) {
          throw error;
        }
      }
    }

    return { processed, failed };
  }
}
