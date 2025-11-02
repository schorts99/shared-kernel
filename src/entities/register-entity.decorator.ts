import { EntityRegistry } from "./entity-registry";
import { Model } from "../models";
import { Entity as BaseEntity } from "./entity";
import { ValueObject } from "../value-objects";

type EntityConstructor<M extends Model = Model> = {
  fromPrimitives(model: M): BaseEntity<ValueObject, M>;
};

export function RegisterEntity<M extends Model = Model>(type: string) {
  return function <Entity extends EntityConstructor<M>>(entity: Entity): Entity {
    EntityRegistry.register(type, entity);

    return entity;
  };
}
