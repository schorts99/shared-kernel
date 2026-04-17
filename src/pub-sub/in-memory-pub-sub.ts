import { Publisher } from "./publisher";
import { Subscriber, Subscription, MessageHandler } from "./subscription";

export class InMemoryPubSub implements Publisher<any>, Subscriber {
  private handlers: Map<string, Map<string, Set<MessageHandler>>> = new Map();

  async publish(channel: string, event: string, payload: any): Promise<void> {
    const channelHandlers = this.handlers.get(channel);

    if (!channelHandlers) return;

    const eventHandlers = channelHandlers.get(event);

    if (!eventHandlers) return;

    eventHandlers.forEach((handler) => {
      try {
        const result = handler(payload);

        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`[InMemoryPubSub] Error in async handler for ${channel}:${event}:`, error);
          });
        }
      } catch (error) {
        console.error(`[InMemoryPubSub] Error in handler for ${channel}:${event}:`, error);
      }
    });
  }

  async subscribe<T = any>(
    channel: string,
    event: string,
    handler: MessageHandler<T>
  ): Promise<Subscription> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Map());
    }

    const channelHandlers = this.handlers.get(channel)!;
    if (!channelHandlers.has(event)) {
      channelHandlers.set(event, new Set());
    }

    const eventHandlers = channelHandlers.get(event)!;

    eventHandlers.add(handler as MessageHandler);

    return {
      unsubscribe: () => {
        eventHandlers.delete(handler as MessageHandler);

        if (eventHandlers.size === 0) {
          channelHandlers.delete(event);
        }

        if (channelHandlers.size === 0) {
          this.handlers.delete(channel);
        }
      },
    };
  }

  clear(): void {
    this.handlers.clear();
  }
}
