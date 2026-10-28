import { Entity } from "./entity";
import { Model } from "../models";
import { EntityNotRegistered } from "./exceptions";

export type EntityFactory<M extends Model = any, E extends Entity<any, M> = any> = (model: M) => E;

export type EntityConstructor<M extends Model = any, E extends Entity<any, M> = any> = {
  new(...args: any[]): E;
  fromPrimitives(model: M): E;
};

export type EntityRegistration<M extends Model = any, E extends Entity<any, M> = any> =
  | EntityConstructor<M, E>
  | EntityFactory<M, E>;

export class EntityRegistry {
  private static registry = new Map<string, EntityRegistration>();

  static register<M extends Model = any, E extends Entity<any, M> = any>(
    entityName: string,
    constructorOrFactory: EntityRegistration<M, E>,
  ): void {
    this.registry.set(entityName, constructorOrFactory);
  }

  static fromPrimitives<M extends Model = any, E extends Entity<any, M> = any>(
    entityName: string,
    model: M
  ): E {
    const registered = this.registry.get(entityName);

    if (!registered) {
      throw new EntityNotRegistered(entityName);
    }

    if (typeof (registered as { fromPrimitives?: unknown }).fromPrimitives === "function") {
      return (registered as EntityConstructor<M, E>).fromPrimitives(model);
    }

    return (registered as EntityFactory<M, E>)(model);
  }
}
