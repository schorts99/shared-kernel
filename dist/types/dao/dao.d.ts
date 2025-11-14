import { Model } from "../models";
import { Entity as BaseEntity } from "../entities";
import { Criteria } from "../criteria";
import { UnitOfWork } from "../unit-of-work";
import { ValueObject } from "../value-objects";
export declare abstract class DAO<M extends Model, Entity extends BaseEntity<ValueObject, M>> {
    protected readonly deleteMod: 'HARD' | 'SOFT';
    constructor(deleteMod?: 'HARD' | 'SOFT');
    abstract getAll(): Promise<Entity[]>;
    abstract findByID(id: Entity["id"]["value"]): Promise<Entity | null>;
    abstract findOneBy(criteria: Criteria): Promise<Entity | null>;
    abstract search(criteria: Criteria): Promise<Entity[]>;
    abstract countBy(criteria: Criteria): Promise<number>;
    abstract create(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
    abstract update(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
    abstract delete(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
}
//# sourceMappingURL=dao.d.ts.map