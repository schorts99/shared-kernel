import { AsyncLocalStorage } from "node:async_hooks";
import type { ExecutionContext, ExecutionContextStorage } from "../types/execution-context";

export class NodeExecutionContext implements ExecutionContext {
  createStorage<T>(): ExecutionContextStorage<T> {
    return new AsyncLocalStorage<T>();
  }
}
