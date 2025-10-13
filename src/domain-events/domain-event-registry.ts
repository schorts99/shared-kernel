import { DomainEvent, DomainEventPrimitives } from ".";
import { DomainEventNotRegistered } from "./exceptions";

type DomainEventConstructor<PayloadSchema = any> = {
  new (
    id: string,
    occurredAt: Date,
    type: string,
    version: number,
    payload: PayloadSchema,
    meta: {
      retries: number,
    },
  ): DomainEvent<PayloadSchema>;
};

export class DomainEventRegistry {
  private static registry = new Map<string, DomainEventConstructor>();

  static register(eventName: string, constructor: DomainEventConstructor): void {
    this.registry.set(eventName, constructor);
  }

  static create(primitives: DomainEventPrimitives): DomainEvent {
    const Constructor = this.registry.get(primitives.type);

    if (!Constructor) {
      throw new DomainEventNotRegistered(primitives.type);
    }

    return new Constructor(
      primitives.id,
      new Date(primitives.occurred_at),
      primitives.type,
      primitives.version,
      primitives.payload,
      primitives.meta,
    );
  }
}
