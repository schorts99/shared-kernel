import { Model } from "../models/index.js";
import { Entity as BaseEntity } from "../entities/index.js";
import { Criteria } from "../criteria/index.js";
import { UnitOfWork } from "../unit-of-work/index.js";
import { ValueObject } from "../value-objects/index.js";
import { DeleteMode } from "./delete-mode.js";

export abstract class DAO<
  M extends Model,
  Entity extends BaseEntity<ValueObject, M>
> {
  constructor(
    protected readonly deleteMode: DeleteMode = "HARD",
  ) {}
  abstract getAll(uow?: UnitOfWork): Promise<Entity[]>;
  abstract findByID(id: M["id"], uow?: UnitOfWork): Promise<Entity | null>;
  abstract findOneBy(criteria: Criteria, uow?: UnitOfWork): Promise<Entity | null>;
  abstract search(criteria: Criteria, uow?: UnitOfWork): Promise<Entity[]>;
  abstract count(uow?: UnitOfWork): Promise<number>;
  abstract countBy(criteria: Criteria, uow?: UnitOfWork): Promise<number>;
  abstract exists(criteria: Criteria, uow?: UnitOfWork): Promise<boolean>;
  abstract create(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
  abstract update(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
  abstract save(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
  abstract delete(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
  abstract deleteByID(id: M["id"], uow?: UnitOfWork): Promise<void>;
  abstract saveMany(entities: Entity[], uow?: UnitOfWork): Promise<Entity[]>;
  abstract restore(entity: Entity, uow?: UnitOfWork): Promise<Entity>;
}
