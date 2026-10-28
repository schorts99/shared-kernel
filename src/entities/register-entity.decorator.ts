import { EntityConstructor, EntityRegistry } from "./entity-registry.js";

export function RegisterEntity(entityName: string) {
  return function (constructor: EntityConstructor) {
    EntityRegistry.register(entityName, constructor);
  };
}
