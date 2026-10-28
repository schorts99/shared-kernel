import { EntityNotRegistered } from "./exceptions";

export type EntityFactory<M = any, E = any> = (model: M) => E;

export type EntityConstructor<M = any, E = any> = {
  new (...args: any[]): E;
  fromPrimitives(model: M): E;
};

export type EntityRegistration<M = any, E = any> =
  | EntityConstructor<M, E>
  | EntityFactory<M, E>;

export class EntityRegistry {
  private static registry = new Map<string, EntityRegistration>();

  static register<M = any, E = any>(
    entityName: string,
    constructorOrFactory: EntityRegistration<M, E>,
  ): void {
    this.registry.set(entityName, constructorOrFactory);
  }

  static fromPrimitives<E = any, M = any>(
    entityName: string,
    model: M,
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
