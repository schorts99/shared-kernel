import { BaseModel } from "../models";
import { Entity as BaseEntity } from "./entity";
import { ValueObject } from "../value-objects";
type EntityConstructor<Model extends BaseModel = BaseModel> = {
    fromPrimitives(model: Model): BaseEntity<ValueObject, Model>;
};
export declare function RegisterEntity<Model extends BaseModel = BaseModel>(type: string): <Entity extends EntityConstructor<Model>>(entity: Entity) => Entity;
export {};
//# sourceMappingURL=register-entity.decorator.d.ts.map