import { EntityRegistry } from "./entity-registry";
import { BaseModel } from "../models";
import { Entity as BaseEntity } from "./entity";
import { ValueObject } from "../value-objects";

type EntityConstructor<Model extends BaseModel = BaseModel> = {
  fromPrimitives(model: Model): BaseEntity<ValueObject, Model>;
};

export function RegisterEntity<Model extends BaseModel = BaseModel>(type: string) {
  return function <Entity extends EntityConstructor<Model>>(entity: Entity): Entity {
    EntityRegistry.register(type, entity);

    return entity;
  };
}
