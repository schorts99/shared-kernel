export interface Publisher<T = any> {
  publish(channel: string, event: string, payload: T): Promise<void>;
}
