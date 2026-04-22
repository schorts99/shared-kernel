import { ErrorStore } from "./error-store";
import { ErrorUploader } from "./error-uploader";
import { Logger } from "../logger";

export interface ErrorTrackerOptions {
  ignoredErrors?: Array<string | (new (...args: any[]) => Error)>;
}

export class ErrorTracker {
  private readonly ignoredErrors: Array<string | (new (...args: any[]) => Error)>;

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
      } else if (typeof ignored === "function" && error instanceof ignored) {
        return true;
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

