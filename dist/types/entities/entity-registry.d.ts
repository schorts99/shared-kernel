import { Model } from "../models";
import { Entity } from "./entity";
import { ValueObject } from "../value-objects";
type EntityConstructor<M extends Model = Model> = {
    fromPrimitives(model: M): Entity<ValueObject, M>;
};
export declare class EntityRegistry {
    private static registry;
    static register<M extends Model>(tableOrCollectionName: string, entity: EntityConstructor<M>): void;
    static resolve<M extends Model>(tableOrCollectionName: string): EntityConstructor<M> | null;
    static create<M extends Model>(tableOrCollectionName: string, model: M): Entity<ValueObject, M>;
}
export {};
//# sourceMappingURL=entity-registry.d.ts.map