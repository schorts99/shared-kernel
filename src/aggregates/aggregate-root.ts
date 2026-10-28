import { ValueObject } from "../value-objects";
import { DomainEvent } from "../domain-events";

export abstract class AggregateRoot<IDValue extends ValueObject> {
  private domainEvents: Array<{ event: DomainEvent; sequenceNumber: number }> = [];
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
    const domainEvents = this.domainEvents.map(({ event, sequenceNumber }) => {
      return Object.assign(event, { sequenceNumber });
    });
    this.domainEvents = [];

    return domainEvents;
  }

  recordDomainEvent(domainEvent: DomainEvent): void {
    this.incrementVersion();
    this.domainEvents.push({
      event: domainEvent,
      sequenceNumber: this._version,
    });
  }

  clearDomainEvents(): void {
    if (this.domainEvents.length > 0) {
      this._version = Math.max(0, this._version - this.domainEvents.length);
      this.domainEvents = [];
    }
  }

  equals(other: unknown): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (!(other instanceof AggregateRoot)) {
      return false;
    }

    if (this.constructor !== other.constructor) {
      return false;
    }

    if (this === other) {
      return true;
    }

    return this.id.equals(other.id);
  }

  protected validateInvariants(): void {}

  protected validate(): void {
    this.validateInvariants();
  }

  abstract toPrimitives(): Record<string, any>;

  static fromPrimitives<T extends AggregateRoot<any> = AggregateRoot<any>>(
    this: abstract new (...args: any[]) => T,
    _model: unknown,
  ): T {
    if (
      _model !== null &&
      typeof _model === "object" &&
      "id" in _model &&
      this.prototype.restoreFromPrimitives &&
      this.prototype.restoreFromPrimitives !== AggregateRoot.prototype.restoreFromPrimitives
    ) {
      const data = _model as Record<string, any>;
      const Ctor = this as unknown as new (id: any, version?: number) => T;
      const rawId =
        typeof this.prototype.createId === "function"
          ? this.prototype.createId(data.id)
          : data.id;
      const instance = new Ctor(rawId, typeof data.version === "number" ? data.version : 0);
      (instance as any).restoreFromPrimitives(data);
      instance.markChangesCommitted();
      return instance;
    }

    throw new Error("Aggregate reconstruction not implemented.");
  }

  protected createId?(rawId: any): IDValue;

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
