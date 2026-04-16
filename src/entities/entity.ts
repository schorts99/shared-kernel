import { ValueObject } from "../value-objects";
import { Model } from "../models";
import { DomainEvent } from "../domain-events";

export abstract class Entity<IDValue extends ValueObject, M extends Model> {
  private domainEvents: Array<DomainEvent> = [];

  constructor(readonly id: IDValue) { }

  pullDomainEvents(): Array<DomainEvent> {
    const domainEvents = [...this.domainEvents];
    this.domainEvents = [];

    return domainEvents;
  }

  recordDomainEvent(domainEvent: DomainEvent): void {
    this.domainEvents.push(domainEvent);
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }

  equals(other: unknown): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (!(other instanceof Entity)) {
      return false;
    }

    if (this === other) {
      return true;
    }

    return this.id.equals(other.id);
  }

  abstract toPrimitives(): M;
}
