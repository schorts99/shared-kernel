import { ValueObject } from "../value-objects";
import { DomainEvent } from "../domain-events";

export abstract class AggregateRoot<IDValue extends ValueObject> {
  private domainEvents: Array<DomainEvent> = [];
  private _version: number = 0;
  private _uncommittedChanges: boolean = false;

  constructor(readonly id: IDValue, version: number = 0) {
    this._version = version;
  }

  get version(): number {
    return this._version;
  }

  protected incrementVersion(): void {
    this._version++;
    this._uncommittedChanges = true;
  }

  get hasUncommittedChanges(): boolean {
    return this._uncommittedChanges;
  }

  markChangesCommitted(): void {
    this._uncommittedChanges = false;
  }

  pullDomainEvents(): Array<DomainEvent & { sequenceNumber: number }> {
    const domainEvents = this.domainEvents.map((event, index) => {
      const sequencedEvent = Object.assign(event, {
        sequenceNumber: this._version - this.domainEvents.length + index + 1,
      });
      return sequencedEvent;
    });
    this.domainEvents = [];

    return domainEvents;
  }

  recordDomainEvent(domainEvent: DomainEvent): void {
    this.domainEvents.push(domainEvent);
    this.incrementVersion();
  }

  equals(other: AggregateRoot<IDValue>): boolean {
    return this.id.equals(other.id);
  }

  protected validateInvariants(): void {}

  protected validate(): void {
    this.validateInvariants();
  }

  abstract toPrimitives(): Record<string, any>;

  static fromPrimitives<Model extends Record<string, any>>(
    this: new (id: any, version?: number) => AggregateRoot<any>,
    model: Model & { id: any; version?: number }
  ): InstanceType<typeof this> {
    const { id, version = 0, ...data } = model;
    const instance = new this(id, version);

    if ((instance as any).restoreFromPrimitives) {
      (instance as any).restoreFromPrimitives(data);
    }

    return instance;
  }

  protected restoreFromPrimitives?(_data: Record<string, any>): void {}

  toSnapshot(): { id: IDValue; version: number; data: Record<string, any> } {
    return {
      id: this.id,
      version: this._version,
      data: this.toPrimitives(),
    };
  }

  static fromSnapshot<T extends AggregateRoot<any>>(
    this: new (id: any, version?: number) => T,
    snapshot: { id: any; version: number; data: Record<string, any> }
  ): T {
    const instance = new this(snapshot.id, snapshot.version);

    if (instance.restoreFromPrimitives) {
      (instance as any).restoreFromPrimitives(snapshot.data);
    }

    instance.markChangesCommitted();
    return instance;
  }
}
