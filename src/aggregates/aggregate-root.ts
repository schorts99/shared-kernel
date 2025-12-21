import { ValueObject } from "../value-objects";
import { DomainEvent } from "../domain-events";

export abstract class AggregateRoot<IDValue extends ValueObject> {
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

  abstract toPrimitives(): Record<string, any>;

  static fromPrimitives<Model extends Record<string, any>>(_model: Model) {
    throw new Error("AggregateRoot reconstruction not implemented.");
  }
}
