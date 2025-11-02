import { Model } from "../models";
import { Entity as BaseEntity } from "../entities";
import { Criteria } from "../criteria";
import { UnitOfWork } from "../unit-of-work";
import { ValueObject } from "../value-objects";
export interface DAO<M extends Model, Entity extends BaseEntity<ValueObject, M>> {
    getAll(): Promise<Entity[]>;
    findByID(id: Entity["id"]["value"]): Promise<Entity | null>;
    findOneBy(criteria: Criteria): Promise<Entity | null>;
    search(criteria: Criteria): Promise<Entity[]>;
    countBy(criteria: Criteria): Promise<number>;
    create(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
    update(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
    delete(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
}
//# sourceMappingURL=dao.d.ts.map