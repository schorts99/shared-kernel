import { ValueObject } from "../value-objects";
import { BaseModel } from "../models";
import { DomainEvent } from "../domain-events";
export declare abstract class Entity<IDValue extends ValueObject, Model extends BaseModel> {
    readonly id: IDValue;
    private domainEvents;
    constructor(id: IDValue);
    pullDomainEvents(): Array<DomainEvent>;
    recordDomainEvent(domainEvent: DomainEvent): void;
    abstract toPrimitives(): Model;
    static fromPrimitives<Model extends BaseModel>(_model: Model): void;
}
//# sourceMappingURL=entity.d.ts.map