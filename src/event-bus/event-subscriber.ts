import { DomainEvent } from "../domain-events";

export interface EventSubscriberOptions {
  logging?: boolean;
  metrics?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
  priority?: number;
}

export interface EventSubscriberContext {
  subscriptionTime: Date;
  metadata: Record<string, any>;
  options: EventSubscriberOptions;
}

export interface EventSubscriber<
  E extends DomainEvent = DomainEvent
> {
  handle(event: E, context?: EventSubscriberContext): Promise<void>;

  subscribedTo(): string[];

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

  getOptions(): EventSubscriberOptions {
    return this.options;
  }
}
