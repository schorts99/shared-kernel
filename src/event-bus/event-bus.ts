import { DomainEvent } from "../domain-events/index.js";
import { EventSubscriber } from "./event-subscriber.js";
import type { BusMetrics, BusRuntimeConfig, BusDispatchOptions, BusCloseOptions } from "../cqrs/bus-runtime.js";

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
  signal?: AbortSignal;
  correlationId?: string;
  startTime: Date;
  metadata: Record<string, unknown>;
  config: EventBusConfig;
}

export interface EventBusConfig extends BusRuntimeConfig {
  enableLogging?: boolean;
  enableMetrics?: boolean;
  autoReplay?: boolean;
  maxRetries?: number;
}

export interface EventBus {
  subscribe<E extends DomainEvent>(eventName: string, subscriber: EventSubscriber<E>): void;

  unsubscribe<E extends DomainEvent>(eventName: string, subscriber: EventSubscriber<E>): boolean;

  publish<E extends DomainEvent>(event: E, options?: BusDispatchOptions): Promise<void>;

  publishMany<E extends DomainEvent>(events: readonly E[], options?: BusDispatchOptions): Promise<void>;

  use(middleware: EventBusMiddleware): void;

  removeMiddleware?(middleware: EventBusMiddleware): boolean;

  hasSubscribers?(eventName: string): boolean;

  getSubscribedEvents?(): string[];

  clear?(): void;

  replay(): Promise<void>;

  getConfig(): EventBusConfig;

  setConfig(config: Partial<EventBusConfig>): void;
  /** With autoReplay enabled, replay after subscriptions are registered; publish also awaits readiness. */
  ready(): Promise<void>;
  getMetrics(): BusMetrics;
  drain(): Promise<void>;
  close(options?: BusCloseOptions): Promise<void>;
}
