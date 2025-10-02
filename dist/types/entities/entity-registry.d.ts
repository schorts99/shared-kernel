import { BaseModel } from "../models";
import { Entity } from "./entity";
import { ValueObject } from "../value-objects";
type EntityConstructor<Model extends BaseModel = BaseModel> = {
    fromPrimitives(model: Model): Entity<ValueObject, Model>;
};
export declare class EntityRegistry {
    private static registry;
    static register<Model extends BaseModel>(tableOrCollectionName: string, entity: EntityConstructor<Model>): void;
    static resolve<Model extends BaseModel>(tableOrCollectionName: string): EntityConstructor<Model> | null;
    static create<Model extends BaseModel>(tableOrCollectionName: string, model: Model): Entity<ValueObject, Model>;
}
export {};
//# sourceMappingURL=entity-registry.d.ts.map