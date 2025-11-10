import { Entity as BaseEntity } from "../entities";
import { ValueObject } from "../value-objects";
import { Model as BaseModel } from "../models";
import { JSONAPIList } from "./json-api-list";
import { JSONAPISingle } from "./json-api-single";
export declare class EntityJSONAPIMapper<Model extends BaseModel, Entity extends BaseEntity<ValueObject, Model>> {
    private readonly type;
    constructor(type: string);
    mapEntity(entity: Entity): JSONAPISingle<Model>;
    mapEntities(entities: Array<Entity>): JSONAPIList<Model>;
}
//# sourceMappingURL=entity-json-api-mapper.d.ts.map