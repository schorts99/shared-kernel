import { ValueObject } from "../value-objects";
import { Model } from "../models";
import { DomainEvent } from "../domain-events";
export declare abstract class Entity<IDValue extends ValueObject, M extends Model> {
    readonly id: IDValue;
    private domainEvents;
    constructor(id: IDValue);
    pullDomainEvents(): Array<DomainEvent>;
    recordDomainEvent(domainEvent: DomainEvent): void;
    abstract toPrimitives(): M;
    static fromPrimitives<M extends Model>(_model: M): void;
}
//# sourceMappingURL=entity.d.ts.map