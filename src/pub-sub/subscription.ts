export type MessageHandler<T = any> = (payload: T) => void | Promise<void>;

export interface Subscription {
  unsubscribe(): void | Promise<void>;
}

export interface Subscriber {
  subscribe<T = any>(
    channel: string,
    event: string,
    handler: MessageHandler<T>
  ): Promise<Subscription>;
}
