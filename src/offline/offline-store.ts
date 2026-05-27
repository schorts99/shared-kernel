export interface OfflineStore<T = unknown> {
  enqueue(key: string, payload: T): Promise<void>;
  list(): Promise<Array<{ key: string; payload: T }>>;
  dequeue(key: string): Promise<void>;
  clear(): Promise<void>;
}
