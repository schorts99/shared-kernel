export interface ExecutionContextStorage<T> {
  /** Must preserve context through async continuations and isolate unrelated requests. */
  getStore(): T | undefined;
  run<R>(store: T, operation: () => R): R;
}

export interface ExecutionContext {
  createStorage<T>(): ExecutionContextStorage<T>;
}
