import { Entity } from "../entities";
import { ValueObject } from "../value-objects";
import { Model as BaseModel } from "../models";

export abstract class AggregateRoot<
  IDValue extends ValueObject,
  Model extends BaseModel
> extends Entity<IDValue, Model> {
  abstract override toPrimitives(): Model;

  static override fromPrimitives<Model extends BaseModel>(_model: Model) {
    throw new Error("AggregateRoot reconstruction not implemented.");
  }
}
