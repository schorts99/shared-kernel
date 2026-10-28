import { Publisher } from "./publisher.js";
import { Subscriber, Subscription, MessageHandler } from "./subscription.js";
import type { Logger } from "../logger/index.js";
import { cloneValue } from "../utils/index.js";

export interface InMemoryPubSubOptions {
  logger?: Logger | undefined;
  throwOnHandlerError?: boolean | undefined;
  onError?: ((error: Error, context: { channel: string; event: string; payload: any }) => void) | undefined;
}

export class InMemoryPubSub implements Publisher<any>, Subscriber {
  private readonly handlers: Map<string, Map<string, Set<MessageHandler>>> = new Map();
  private readonly logger?: Logger | undefined;
  private readonly throwOnHandlerError: boolean;
  private readonly onError?:
    | ((error: Error, context: { channel: string; event: string; payload: any }) => void)
    | undefined;

  constructor(options: InMemoryPubSubOptions = {}) {
    this.logger = options.logger;
    this.throwOnHandlerError = options.throwOnHandlerError ?? false;
    this.onError = options.onError;
  }

  async publish(channel: string, event: string, payload: any): Promise<void> {
    const matchedHandlers = new Set<MessageHandler>();

    const collectFromChannel = (targetChannel: string) => {
      const channelHandlers = this.handlers.get(targetChannel);
      if (!channelHandlers) return;

      channelHandlers.get(event)?.forEach(h => matchedHandlers.add(h));
      if (event !== "*") {
        channelHandlers.get("*")?.forEach(h => matchedHandlers.add(h));
      }
    };

    collectFromChannel(channel);
    if (channel !== "*") {
      collectFromChannel("*");
    }

    if (matchedHandlers.size === 0) return;

    const errors: Error[] = [];

    for (const handler of Array.from(matchedHandlers)) {
      try {
        await handler(cloneValue(payload));
      } catch (rawError) {
        const error = rawError instanceof Error ? rawError : new Error(String(rawError));
        this.logger?.error(
          `Error in handler for ${channel}:${event}`,
          { channel, event, error: error.message },
          error,
        );
        this.onError?.(error, { channel, event, payload: cloneValue(payload) });
        errors.push(error);
      }
    }

    if (this.throwOnHandlerError && errors.length > 0) {
      if (errors.length === 1) {
        throw errors[0]!;
      }
      throw new AggregateError(errors, `Multiple handler errors for ${channel}:${event}`);
    }
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
