import { ValueObject } from "../value-objects";
import { Model } from "../models";
import { DomainEvent } from "../domain-events";

export abstract class Entity<IDValue extends ValueObject, M extends Model> {
  private domainEvents: Array<DomainEvent> = [];

  constructor(readonly id: IDValue) {}

  pullDomainEvents(): Array<DomainEvent> {
    const domainEvents = [...this.domainEvents];
    this.domainEvents = [];

    return domainEvents;
  }

  recordDomainEvent(domainEvent: DomainEvent): void {
    this.domainEvents.push(domainEvent);
  }

  abstract toPrimitives(): M;
  static fromPrimitives<M extends Model>(_model: M) {
    throw new Error("Method not implemented.");
  }
}
