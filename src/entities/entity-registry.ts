import { BaseModel } from "../models";
import { Entity } from "./entity";
import { EntityNotRegistered } from "./exceptions";
import { ValueObject } from "../value-objects";

type EntityConstructor<Model extends BaseModel = BaseModel> = {
  fromPrimitives(model: Model): Entity<ValueObject, Model>;
};

export class EntityRegistry {
  private static registry = new Map<string, EntityConstructor>();

  static register<Model extends BaseModel>(type: string, entity: EntityConstructor<Model>): void {
    this.registry.set(type, entity);
  }

  static resolve<Model extends BaseModel>(type: string): EntityConstructor<Model> | null {
    return (this.registry.get(type) || null) as EntityConstructor<Model> | null;
  }

  static create<Model extends BaseModel>(type: string, model: Model): Entity<ValueObject, Model> {
    const entity = this.resolve<Model>(type);

    if (!entity) {
      throw new EntityNotRegistered(`Entity type "${type}" not registered`);
    }

    return entity.fromPrimitives(model);
  }
}
