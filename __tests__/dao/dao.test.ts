import { expectTypeOf } from "expect-type";

import { DAO } from "../../src/dao";
import { Entity } from "../../src/entities";
import { Criteria } from "../../src/criteria";
import { UUIDValue } from "../../src/value-objects";

type Model = {
  id: string;
  name: string;
};

class IDValue extends UUIDValue {
  attributeName = "ID";
}

class ModelEntity extends Entity<IDValue, Model> {
  toPrimitives(): Model {
    throw new Error("Method not implemented.");
  }
}

describe("DAO", () => {
  describe('#getAll', () => {
    it('should declare the method', () => {
      expectTypeOf<DAO<Model, ModelEntity>>().toHaveProperty("getAll");
    });

    it('should no require any arguments', () => {
      expectTypeOf<DAO<Model, ModelEntity>['getAll']>().parameters.toEqualTypeOf<[]>();
    });

    it('should return a promise with the Entity', () => {
      expectTypeOf<DAO<Model, ModelEntity>['getAll']>().returns.toEqualTypeOf<Promise<ModelEntity[]>>();
    });
  });

  describe('#findByID', () => {
    it('should declare the method', () => {
      expectTypeOf<DAO<Model, ModelEntity>>().toHaveProperty("findByID");
    });

    it('should require the ID argument', () => {
      expectTypeOf<DAO<Model, ModelEntity>['findByID']>().parameters.toEqualTypeOf<[ModelEntity["id"]["value"]]>();
    });

    it('should return a promise with the Entity or null', () => {
      expectTypeOf<DAO<Model, ModelEntity>['findByID']>().returns.toEqualTypeOf<Promise<ModelEntity | null>>();
    });
  });

  describe('#findOneBy', () => {
    it('should declare the method', () => {
      expectTypeOf<DAO<Model, ModelEntity>>().toHaveProperty("findOneBy");
    });

    it('should receive the criteria', () => {
      expectTypeOf<DAO<Model, ModelEntity>['findOneBy']>().parameters.toEqualTypeOf<[Criteria]>();
    });

    it('should return a promise with the Entity or null', () => {
      expectTypeOf<DAO<Model, ModelEntity>['findOneBy']>().returns.toEqualTypeOf<Promise<ModelEntity | null>>();
    });
  });

  describe('#search', () => {
    it('should declare the method', () => {
      expectTypeOf<DAO<Model, ModelEntity>>().toHaveProperty("search");
    });

    it('should receive the criteria argument', () => {
      expectTypeOf<DAO<Model, ModelEntity>['search']>().parameters.toEqualTypeOf<[Criteria]>();
    });

    it('should return a promise with an array of entities', () => {
      expectTypeOf<DAO<Model, ModelEntity>['search']>().returns.toEqualTypeOf<Promise<ModelEntity[]>>();
    });
  });

  describe('#create', () => {
    it('should declare the method', () => {
      expectTypeOf<DAO<Model, ModelEntity>>().toHaveProperty("create");
    });

    it('should return a promise with the created entity', () => {
      expectTypeOf<DAO<Model, ModelEntity>['create']>().returns.toEqualTypeOf<Promise<ModelEntity>>();
    });
  });

  describe('#update', () => {
    it('should declare the method', () => {
      expectTypeOf<DAO<Model, ModelEntity>>().toHaveProperty("update");
    });

    it('should return a promise with the updated entity', () => {
      expectTypeOf<DAO<Model, ModelEntity>['update']>().returns.toEqualTypeOf<Promise<ModelEntity>>();
    });
  });

  describe('#delete', () => {
    it('should declare the method', () => {
      expectTypeOf<DAO<Model, ModelEntity>>().toHaveProperty("delete");
    });

    it('should return a promise with the deleted entity', () => {
      expectTypeOf<DAO<Model, ModelEntity>['delete']>().returns.toEqualTypeOf<Promise<ModelEntity>>();
    });
  });
});
