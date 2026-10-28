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

  static fromPrimitives<T extends Entity<any, any> = Entity<any, any>>(
    this: abstract new (...args: any[]) => T,
    _model: unknown,
  ): T {
    if (
      _model !== null &&
      typeof _model === "object" &&
      "id" in _model &&
      this.prototype.restoreFromPrimitives &&
      this.prototype.restoreFromPrimitives !== Entity.prototype.restoreFromPrimitives
    ) {
      const data = _model as Record<string, any>;
      const Ctor = this as unknown as new (id: any) => T;
      const rawId =
        typeof this.prototype.createId === "function"
          ? this.prototype.createId(data.id)
          : data.id;
      const instance = new Ctor(rawId);
      (instance as any).restoreFromPrimitives(data);
      return instance;
    }

    throw new Error("Entity reconstruction not implemented.");
  }

  protected createId?(rawId: any): IDValue;

  protected restoreFromPrimitives?(_data: M): void {}
}
