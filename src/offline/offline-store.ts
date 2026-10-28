import { OfflinePayload } from "./offline-payload.js";

export interface OfflineStore<T = OfflinePayload> {
  enqueue(key: string, payload: T): Promise<void>;
  list(): Promise<Array<{ key: string; payload: T }>>;
  dequeue(key: string): Promise<void>;
  clear(): Promise<void>;
}
