import { DomainEvent } from "../domain-events";
import { EventSubscriber } from "./event-subscriber";

export interface EventBusMiddleware {
  beforePublish?<E extends DomainEvent>(
    event: E,
    context: EventBusContext
  ): Promise<void>;

  afterPublish?<E extends DomainEvent>(
    event: E,
    context: EventBusContext
  ): Promise<void>;

  onError?<E extends DomainEvent>(
    event: E,
    error: Error,
    context: EventBusContext
  ): Promise<void>;
}

export interface EventBusContext {
  correlationId?: string;
  startTime: Date;
  metadata: Record<string, any>;
  config: EventBusConfig;
}

export interface EventBusConfig {
  enableLogging?: boolean;
  enableMetrics?: boolean;
  autoReplay?: boolean;
  maxRetries?: number;
}

export interface EventBus {
  subscribe<E extends DomainEvent>(eventName: string, subscriber: EventSubscriber<E>): void;

  unsubscribe<E extends DomainEvent>(eventName: string, subscriber: EventSubscriber<E>): boolean;

  publish<E extends DomainEvent>(event: E): Promise<void>;

  publishMany<E extends DomainEvent>(events: readonly E[]): Promise<void>;

  use(middleware: EventBusMiddleware): void;

  replay(): Promise<void>;

  getConfig(): EventBusConfig;

  setConfig(config: Partial<EventBusConfig>): void;
}
