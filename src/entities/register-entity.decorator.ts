import { EntityConstructor, EntityRegistry } from "./entity-registry";

export function RegisterEntity(entityName: string) {
  return function (constructor: EntityConstructor) {
    EntityRegistry.register(entityName, constructor);
  };
}
