import { ValueObject } from "../value-objects";
import { BaseModel } from "../models";
import { DomainEvent } from "../domain-events";
export declare abstract class Entity<Model extends BaseModel> {
    readonly id: ValueObject;
    private domainEvents;
    constructor(id: ValueObject);
    pullDomainEvents(): Array<DomainEvent>;
    recordDomainEvent(domainEvent: DomainEvent): void;
    abstract toPrimitives(): Model;
}
//# sourceMappingURL=entity.d.ts.map