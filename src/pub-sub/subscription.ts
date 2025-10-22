export interface Subscription {
  init(...args: any[]): void;
  connect(): void;
  subscribe(channel: string, event: string, handler: (payload: any) => void): void;
  unsubscribe(channel: string): void;
  disconnect(): void;
}
