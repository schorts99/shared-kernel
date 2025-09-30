import { BaseModel } from "../models";
import { Entity as BaseEntity } from "../entities";
import { Criteria } from "../criteria";

export interface DAO<Model extends BaseModel, Entity extends BaseEntity<Model>> {
  getAll(): Promise<Entity[]>;
  findByID(id: Entity["id"]["value"]): Promise<Entity | null>;
  findOneBy(criteria: Criteria): Promise<Entity | null>;
  search(criteria: Criteria): Promise<Entity[]>;
  create(entity: Entity): Promise<Entity>;
  update(entity: Entity): Promise<Entity>;
  delete(entity: Entity): Promise<Entity>;
}
