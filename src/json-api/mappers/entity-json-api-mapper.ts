import {
  Entity as BaseEntity,
  EntityRegistration,
  EntityRegistry,
} from "../../entities/index.js";
import { ValueObject } from "../../value-objects/index.js";
import { Model as BaseModel } from "../../models/index.js";
import { cloneValue } from "../../utils/object.js";
import { JSONAPIList } from "../json-api-list.js";
import { JSONAPISingle } from "../json-api-single.js";

export class EntityJSONAPIMapper<
  Model extends BaseModel,
  Entity extends BaseEntity<ValueObject, Model>,
> {
  constructor(
    private readonly type: string,
    private readonly entityRegistration?: EntityRegistration<Model, Entity>,
  ) {}

  mapEntity(entity: Entity): JSONAPISingle<Model> {
    const { id: _, ...attributes } = cloneValue(entity.toPrimitives()) as Record<string, any>;

    return {
      data: {
        type: this.type,
        id: entity.id.value as string,
        attributes: attributes as Omit<Model, "id">,
      },
    };
  }

  mapEntities(entities: Array<Entity>): JSONAPIList<Model> {
    return { data: entities.map((e) => this.mapEntity(e).data) };
  }

  toEntity(doc: JSONAPISingle<Model>): Entity {
    return this.hydrateResource(doc.data);
  }

  toEntities(doc: JSONAPIList<Model>): Array<Entity> {
    return doc.data.map((resource) => this.hydrateResource(resource));
  }

  private hydrateResource(resource: {
    id: string;
    type: string;
    attributes: Omit<Model, "id">;
  }): Entity {
    const primitives = {
      ...cloneValue(resource.attributes),
      id: resource.id,
    } as unknown as Model;

    if (this.entityRegistration) {
      if (typeof (this.entityRegistration as { fromPrimitives?: unknown }).fromPrimitives === "function") {
        return (this.entityRegistration as { fromPrimitives(model: unknown): Entity }).fromPrimitives(
          primitives,
        );
      }
      return (this.entityRegistration as (model: unknown) => Entity)(primitives);
    }

    return EntityRegistry.fromPrimitives<Entity>(resource.type || this.type, primitives);
  }
}
