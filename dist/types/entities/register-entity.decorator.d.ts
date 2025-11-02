import { Model } from "../models";
import { Entity as BaseEntity } from "./entity";
import { ValueObject } from "../value-objects";
type EntityConstructor<M extends Model = Model> = {
    fromPrimitives(model: M): BaseEntity<ValueObject, M>;
};
export declare function RegisterEntity<M extends Model = Model>(type: string): <Entity extends EntityConstructor<M>>(entity: Entity) => Entity;
export {};
//# sourceMappingURL=register-entity.decorator.d.ts.map