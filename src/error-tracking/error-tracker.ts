import { ErrorStore } from "./error-store";
import { ErrorUploader } from "./error-uploader";
import { Logger } from "../logger";

export type IgnoredErrorPattern =
  | string
  | RegExp
  | (new (...args: any[]) => Error)
  | ((error: Error | string) => boolean);

export interface ErrorTrackerOptions {
  ignoredErrors?: IgnoredErrorPattern[];
}

export class ErrorTracker {
  private readonly ignoredErrors: IgnoredErrorPattern[];
  private syncQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: ErrorStore,
    private readonly uploader: ErrorUploader,
    private readonly logger?: Logger,
    options?: ErrorTrackerOptions
  ) {
    this.ignoredErrors = options?.ignoredErrors || [];
  }

  private shouldIgnore(error: Error | string): boolean {
    if (this.ignoredErrors.length === 0) return false;

    for (const ignored of this.ignoredErrors) {
      if (typeof ignored === "string") {
        if (typeof error === "string") {
          if (error.includes(ignored)) return true;
        } else {
          if (error.name === ignored || error.constructor.name === ignored || error.message.includes(ignored)) {
            return true;
          }
        }
      } else if (ignored instanceof RegExp) {
        const statelessRegex = new RegExp(ignored.source, ignored.flags.replace(/[gy]/g, ""));
        if (typeof error === "string") {
          if (statelessRegex.test(error)) return true;
        } else {
          if (
            statelessRegex.test(error.name) ||
            statelessRegex.test(error.constructor.name) ||
            statelessRegex.test(error.message)
          ) {
            return true;
          }
        }
      } else if (typeof ignored === "function") {
        const isErrorConstructor =
          ignored === Error || Boolean(ignored.prototype && ignored.prototype instanceof Error);
        if (isErrorConstructor) {
          if (error instanceof Error && error instanceof ignored) {
            return true;
          }
        } else {
          if (Boolean(ignored.prototype) && typeof error === "object" && error !== null && error instanceof ignored) {
            return true;
          }
          try {
            if ((ignored as (err: Error | string) => boolean)(error)) {
              return true;
            }
          } catch {
            // Non-callable class constructor; ignore
          }
        }
      }
    }

    return false;
  }

  async track(error: Error | string, context?: Record<string, unknown>, reason?: string): Promise<void> {
    if (this.shouldIgnore(error)) {
      return;
    }

    try {
      await this.store.add(error, context, reason);
    } catch (err) {
      this.logger?.error("[ErrorTracker track] Failed to store tracked error", { context, reason }, err instanceof Error ? err : undefined);
    }
  }

  async sync(): Promise<void> {
    const run = this.syncQueue.then(() => this.performSync());
    this.syncQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async performSync(): Promise<void> {
    try {
      const pendingErrors = await this.store.all();

      if (pendingErrors.length === 0) {
        return;
      }

      await this.uploader.upload(pendingErrors);

      const uploadedIds = pendingErrors.map(e => e.id);
      await this.store.remove(uploadedIds);
    } catch (err) {
      this.logger?.error("[ErrorTracker sync] Failed to sync tracked errors", {}, err instanceof Error ? err : undefined);
    }
  }
}

