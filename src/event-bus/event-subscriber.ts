import { DomainEvent } from "../domain-events/index.js";

export interface EventSubscriberOptions {
  logging?: boolean;
  metrics?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
  priority?: number;
}

export interface EventSubscriberContext {
  signal?: AbortSignal;
  subscriptionTime: Date;
  metadata: Record<string, unknown>;
  options: EventSubscriberOptions;
}

export interface EventSubscriber<
  E extends DomainEvent = DomainEvent
> {
  handle(event: E, context?: EventSubscriberContext): Promise<void>;
  subscribedTo(): string[];
  /** Stable delivery identity, unique among subscribers to the same event. */
  getName(): string;
  getOptions?(): EventSubscriberOptions;
}

export abstract class AbstractEventSubscriber<
  E extends DomainEvent = DomainEvent
> implements EventSubscriber<E> {
  protected readonly options: EventSubscriberOptions;

  constructor(options: EventSubscriberOptions = {}) {
    this.options = {
      logging: false,
      metrics: false,
      retryOnError: false,
      maxRetries: 0,
      priority: 0,
      ...options,
    };
  }

  abstract handle(event: E, context?: EventSubscriberContext): Promise<void>;
  abstract subscribedTo(): string[];

  getName(): string {
    return this.constructor.name;
  };

  getOptions(): EventSubscriberOptions {
    return this.options;
  }
}
