import { Model } from "../models";
import { Entity as BaseEntity } from "../entities";
import { Criteria } from "../criteria";
import { UnitOfWork } from "../unit-of-work";
import { ValueObject } from "../value-objects";
import { DeleteMode } from "./delete-mode";

export abstract class DAO<
  M extends Model,
  Entity extends BaseEntity<ValueObject, M>,
  ID = Entity["id"]["value"]
> {
  constructor(
    protected readonly deleteMode: DeleteMode = "HARD",
  ) { }
  abstract getAll(uow?: UnitOfWork): Promise<Entity[]>;

  abstract findByID(id: ID, uow?: UnitOfWork): Promise<Entity | null>;

  abstract findOneBy(criteria: Criteria, uow?: UnitOfWork): Promise<Entity | null>;

  abstract countBy(criteria: Criteria, uow?: UnitOfWork): Promise<number>;

  abstract exists(criteria: Criteria, uow?: UnitOfWork): Promise<boolean>;

  abstract create(entity: Entity, uow?: UnitOfWork): Promise<Entity>;

  abstract update(entity: Entity, uow?: UnitOfWork): Promise<Entity>;

  abstract save(entity: Entity, uow?: UnitOfWork): Promise<Entity>;

  abstract delete(entity: Entity, uow?: UnitOfWork): Promise<Entity>;

  abstract deleteByID(id: ID, uow?: UnitOfWork): Promise<void>;

  abstract saveMany(entities: Entity[], uow?: UnitOfWork): Promise<Entity[]>;

  abstract restore(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
}
