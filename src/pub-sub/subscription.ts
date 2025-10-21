export interface Subscription {
  init(): void;
  connect(): void;
  subscribe(channel: string, event: string, handler: (payload: any) => void): void;
  unsubscribe(channel: string): void;
  disconnect(): void;
}
