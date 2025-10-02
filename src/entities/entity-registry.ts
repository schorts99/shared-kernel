import { BaseModel } from "../models";
import { Entity } from "./entity";
import { EntityNotRegistered } from "./exceptions";
import { ValueObject } from "../value-objects";

type EntityConstructor<Model extends BaseModel = BaseModel> = {
  fromPrimitives(model: Model): Entity<ValueObject, Model>;
};

export class EntityRegistry {
  private static registry = new Map<string, EntityConstructor>();

  static register<Model extends BaseModel>(tableOrCollectionName: string, entity: EntityConstructor<Model>): void {
    this.registry.set(tableOrCollectionName, entity);
  }

  static resolve<Model extends BaseModel>(tableOrCollectionName: string): EntityConstructor<Model> | null {
    return (this.registry.get(tableOrCollectionName) || null) as EntityConstructor<Model> | null;
  }

  static create<Model extends BaseModel>(tableOrCollectionName: string, model: Model): Entity<ValueObject, Model> {
    const entity = this.resolve<Model>(tableOrCollectionName);

    if (!entity) {
      throw new EntityNotRegistered(tableOrCollectionName);
    }

    return entity.fromPrimitives(model);
  }
}
