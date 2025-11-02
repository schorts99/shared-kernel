import { Model } from "../models";
import { Entity } from "./entity";
import { EntityNotRegistered } from "./exceptions";
import { ValueObject } from "../value-objects";

type EntityConstructor<M extends Model = Model> = {
  fromPrimitives(model: M): Entity<ValueObject, M>;
};

export class EntityRegistry {
  private static registry = new Map<string, EntityConstructor>();

  static register<M extends Model>(tableOrCollectionName: string, entity: EntityConstructor<M>): void {
    this.registry.set(tableOrCollectionName, entity);
  }

  static resolve<M extends Model>(tableOrCollectionName: string): EntityConstructor<M> | null {
    return (this.registry.get(tableOrCollectionName) || null) as EntityConstructor<M> | null;
  }

  static create<M extends Model>(tableOrCollectionName: string, model: M): Entity<ValueObject, M> {
    const entity = this.resolve<M>(tableOrCollectionName);

    if (!entity) {
      throw new EntityNotRegistered(tableOrCollectionName);
    }

    return entity.fromPrimitives(model);
  }
}
