import { ErrorStore } from "../error-store";
import { TrackedError } from "../tracked-error";
import { cloneValue } from "../../utils/object";

export interface InMemoryErrorStoreOptions {
  /** Maximum number of tracked errors retained before evicting the oldest entry (default 1,000). */
  maxErrors?: number;
}

export class InMemoryErrorStore implements ErrorStore {
  private readonly errors = new Map<string, TrackedError>();
  private readonly maxErrors: number;

  constructor(options: InMemoryErrorStoreOptions = {}) {
    const max = options.maxErrors ?? 1_000;
    if (!Number.isSafeInteger(max) || max < 1) {
      throw new RangeError("maxErrors must be a positive safe integer");
    }
    this.maxErrors = max;
  }

  async add(
    error: Error | string,
    context?: Record<string, unknown>,
    reason?: string,
  ): Promise<void> {
    if (this.errors.size >= this.maxErrors) {
      const oldest = this.errors.keys().next();
      if (!oldest.done) {
        this.errors.delete(oldest.value);
      }
    }

    const id =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const tracked: TrackedError = {
      id,
      error,
      timestamp: new Date(),
      ...(context !== undefined ? { context: cloneValue(context) } : {}),
      ...(reason !== undefined ? { reason } : {}),
    };

    this.errors.set(id, tracked);
  }

  async all(): Promise<Array<TrackedError>> {
    return Array.from(this.errors.values()).map(entry => ({
      id: entry.id,
      error: entry.error,
      timestamp: new Date(entry.timestamp.getTime()),
      ...(entry.context !== undefined ? { context: cloneValue(entry.context) } : {}),
      ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
    }));
  }

  async remove(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.errors.delete(id);
    }
  }

  async clear(): Promise<void> {
    this.errors.clear();
  }
}
