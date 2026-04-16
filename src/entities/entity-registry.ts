import { Entity } from "./entity";
import { Model } from "../models";
import { EntityNotRegistered } from "./exceptions";

export type EntityConstructor<M extends Model = any, E extends Entity<any, M> = any> = {
  new(...args: any[]): E;
  fromPrimitives(model: M): E;
};

export class EntityRegistry {
  private static registry = new Map<string, EntityConstructor>();

  static register(entityName: string, constructor: EntityConstructor): void {
    this.registry.set(entityName, constructor);
  }

  static fromPrimitives<M extends Model = any, E extends Entity<any, M> = any>(
    entityName: string,
    model: M
  ): E {
    const Constructor = this.registry.get(entityName);

    if (!Constructor) {
      throw new EntityNotRegistered(entityName);
    }

    return Constructor.fromPrimitives(model) as E;
  }
}
