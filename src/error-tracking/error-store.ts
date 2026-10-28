import { TrackedError } from "./tracked-error.js";

export interface ErrorStore {
  add(error: Error | string, context?: Record<string, unknown>, reason?: string): Promise<void>;
  all(): Promise<Array<TrackedError>>;
  remove(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}
