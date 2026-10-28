import { DomainEvent } from "./domain-event.js";
import { DomainEventMetadata, DomainEventPrimitives } from "./domain-event-metadata.js";
import { DomainEventNotRegistered } from "./exceptions/index.js";

export type DomainEventFactory<E extends DomainEvent = DomainEvent> = (
  primitives: DomainEventPrimitives,
) => E;

export type DomainEventConstructor<T = any, E extends DomainEvent<T> = DomainEvent<T>> =
  | {
      new (...args: any[]): E;
      fromPrimitives(primitives: DomainEventPrimitives): E;
    }
  | {
      new (
        correlationId: string,
        payload: T,
        metadata?: Partial<DomainEventMetadata>,
      ): E;
      fromPrimitives?(primitives: DomainEventPrimitives): E;
    };

export type DomainEventRegistration<T = any, E extends DomainEvent<T> = DomainEvent<T>> =
  | DomainEventConstructor<T, E>
  | DomainEventFactory<E>;

function isClassConstructor(fn: unknown): fn is new (...args: any[]) => DomainEvent {
  return (
    typeof fn === "function" &&
    fn.prototype !== undefined &&
    fn.prototype.constructor === fn
  );
}

export class DomainEventRegistry {
  private static registry = new Map<string, DomainEventRegistration>();

  static register<T = any, E extends DomainEvent<T> = DomainEvent<T>>(
    eventName: string,
    constructorOrFactory: DomainEventRegistration<T, E>,
  ): void {
    this.registry.set(eventName, constructorOrFactory);
  }

  static has(eventName: string): boolean {
    return this.registry.has(eventName);
  }

  static unregister(eventName: string): boolean {
    return this.registry.delete(eventName);
  }

  static clear(): void {
    this.registry.clear();
  }

  static fromPrimitives<E extends DomainEvent = DomainEvent>(primitives: DomainEventPrimitives): E {
    const registered = this.registry.get(primitives.type);

    if (!registered) {
      throw new DomainEventNotRegistered(primitives.type);
    }

    if (typeof (registered as { fromPrimitives?: unknown }).fromPrimitives === "function") {
      return (
        registered as unknown as { fromPrimitives(p: DomainEventPrimitives): E }
      ).fromPrimitives(primitives);
    }

    if (!isClassConstructor(registered)) {
      return (registered as unknown as DomainEventFactory<E>)(primitives);
    }

    const Constructor = registered as unknown as new (
      correlationId: string,
      payload: any,
      metadata?: Partial<DomainEventMetadata>,
    ) => E;

    return new Constructor(
      primitives.correlation_id,
      primitives.payload,
      {
        id: primitives.id,
        occurredAt: new Date(primitives.occurred_at),
        correlationId: primitives.correlation_id,
        causationId: primitives.causation_id,
        requestId: primitives.request_id,
        version: primitives.version,
        userId: primitives.user_id,
        tenantId: primitives.tenant_id,
        retries: primitives.meta?.retries,
        headers: primitives.meta?.headers,
        context: primitives.meta?.context,
      },
    );
  }
}

export function DomainEventMapping(eventName: string) {
  return function (constructor: DomainEventConstructor) {
    DomainEventRegistry.register(eventName, constructor);
  };
}
