import { Entity as BaseEntity } from "../entities";
import { ValueObject } from "../value-objects";
import { Model as BaseModel } from "../models";
import { JSONAPIList } from "./json-api-list";
import { JSONAPISingle } from "./json-api-single";

export class EntityJSONAPIMapper {
  static mapEntity<Model extends BaseModel, Entity extends BaseEntity<ValueObject, Model>>(
    entity: Entity,
  ): JSONAPISingle<Model> {
    const attributes: Record<string, any> = entity.toPrimitives();

    delete attributes.id;

    return {
      data: {
        type: entity.type,
        id: entity.id.value as string,
        attributes: attributes as Omit<Model, "id">,
      },
    };
  }

  static mapEntities<Model extends BaseModel, Entity extends BaseEntity<ValueObject, Model>>(
    entities: Array<Entity>,
  ): JSONAPIList<Model> {
    return { data: entities.map((e) => this.mapEntity<Model, Entity>(e).data) };
  }
}
