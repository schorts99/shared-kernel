import { DomainEvent } from "./domain-event";
import { DomainEventMetadata, DomainEventPrimitives } from "./domain-event-metadata";
import { DomainEventNotRegistered } from "./exceptions";

export type DomainEventConstructor = {
  new(
    correlationId: string,
    metadata?: Partial<DomainEventMetadata>,
  ): DomainEvent;
};

export class DomainEventRegistry {
  private static registry = new Map<string, DomainEventConstructor>();

  static register(eventName: string, constructor: DomainEventConstructor): void {
    this.registry.set(eventName, constructor);
  }

  static fromPrimitives(primitives: DomainEventPrimitives): DomainEvent {
    const Constructor = this.registry.get(primitives.type);

    if (!Constructor) {
      throw new DomainEventNotRegistered(primitives.type);
    }

    return new Constructor(
      primitives.correlation_id,
      {
        id: primitives.id,
        occurredAt: new Date(primitives.occurred_at),
        causationId: primitives.causation_id,
        requestId: primitives.request_id,
        version: primitives.version,
        userId: primitives.user_id,
        tenantId: primitives.tenant_id,
        retries: primitives.meta.retries,
        headers: primitives.meta.headers,
        context: primitives.meta.context,
      },
    );
  }
}

export function DomainEventMapping(eventName: string) {
  return function (constructor: DomainEventConstructor) {
    DomainEventRegistry.register(eventName, constructor);
  };
}
