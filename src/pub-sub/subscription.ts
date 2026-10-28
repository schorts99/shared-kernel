export type MessageHandler<T = unknown> = (payload: T) => void | Promise<void>;

export interface Subscription {
  unsubscribe(): void | Promise<void>;
}

export interface Subscriber {
  subscribe<T = unknown>(
    channel: string,
    event: string,
    handler: MessageHandler<T>
  ): Promise<Subscription>;
}
