import { Model } from "../models";
import { Entity as BaseEntity } from "../entities";
import { Criteria } from "../criteria";
import { UnitOfWork } from "../unit-of-work";
import { ValueObject } from "../value-objects";
import { DeleteMode } from "./delete-mode";
import { MaybePromise } from "../types";
export declare abstract class DAO<M extends Model, Entity extends BaseEntity<ValueObject, M>, IsAsync extends boolean = false> {
    protected readonly deleteMode: DeleteMode;
    constructor(deleteMode?: DeleteMode);
    abstract getAll(): MaybePromise<IsAsync, Entity[]>;
    abstract findByID(id: Entity["id"]["value"]): MaybePromise<IsAsync, Entity | null>;
    abstract findOneBy(criteria: Criteria): MaybePromise<IsAsync, Entity | null>;
    abstract search(criteria: Criteria): MaybePromise<IsAsync, Entity[]>;
    abstract countBy(criteria: Criteria): MaybePromise<IsAsync, number>;
    abstract create(entity: Entity, uow?: UnitOfWork): MaybePromise<IsAsync, Entity>;
    abstract update(entity: Entity, uow?: UnitOfWork): MaybePromise<IsAsync, Entity>;
    abstract delete(entity: Entity, uow?: UnitOfWork): MaybePromise<IsAsync, Entity>;
}
//# sourceMappingURL=dao.d.ts.map