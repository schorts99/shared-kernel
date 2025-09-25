import { ValueObject } from "../value-objects";
import { BaseModel } from "../models";
import { DomainEvent } from "../domain-events";

export abstract class Entity<Model extends BaseModel> {
  private domainEvents: Array<DomainEvent> = [];

  constructor(readonly id: ValueObject) {}

  pullDomainEvents(): Array<DomainEvent> {
    const domainEvents = [...this.domainEvents];
    this.domainEvents = [];

    return domainEvents;
  }

  recordDomainEvent(domainEvent: DomainEvent): void {
    this.domainEvents.push(domainEvent);
  }

  abstract toPrimitives(): Model;
}
