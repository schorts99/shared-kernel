export interface Publisher<T = unknown> {
  publish(channel: string, event: string, payload: T): Promise<void>;
}
