import { Entity as BaseEntity } from "../entities";
import { ValueObject } from "../value-objects";
import { Model as BaseModel } from "../models";
import { JSONAPIList } from "./json-api-list";
import { JSONAPISingle } from "./json-api-single";
export declare class EntityJSONAPIMapper {
    static mapEntity<Model extends BaseModel, Entity extends BaseEntity<ValueObject, Model>>(entity: Entity): JSONAPISingle<Model>;
    static mapEntities<Model extends BaseModel, Entity extends BaseEntity<ValueObject, Model>>(entities: Array<Entity>): JSONAPIList<Model>;
}
//# sourceMappingURL=entity-json-api-mapper.d.ts.map