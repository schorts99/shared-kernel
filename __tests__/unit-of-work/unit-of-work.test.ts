import { expectTypeOf } from "expect-type";

import { UnitOfWork } from "../../src/unit-of-work";

describe("UnitOfWork", () => {
  describe('#begin', () => {
    it('should declare the method', () => {
      expectTypeOf<UnitOfWork>().toHaveProperty("begin");
    });

    it('should no require any arguments', () => {
      expectTypeOf<UnitOfWork['begin']>().parameters.toEqualTypeOf<[]>();
    });

    it('should return a promise', () => {
      expectTypeOf<UnitOfWork['begin']>().returns.toEqualTypeOf<Promise<void>>();
    });
  })

  describe('#commit', () => {
    it('should declare the method', () => {
      expectTypeOf<UnitOfWork>().toHaveProperty("commit");
    });

    it('should no require any arguments', () => {
      expectTypeOf<UnitOfWork['commit']>().parameters.toEqualTypeOf<[]>();
    });

    it('should return a promise', () => {
      expectTypeOf<UnitOfWork['commit']>().returns.toEqualTypeOf<Promise<void>>();
    });
  })

  describe('#rollback', () => {
    it('should declare the method', () => {
      expectTypeOf<UnitOfWork>().toHaveProperty("rollback");
    });

    it('should no require any arguments', () => {
      expectTypeOf<UnitOfWork['rollback']>().parameters.toEqualTypeOf<[]>();
    });

    it('should return a promise', () => {
      expectTypeOf<UnitOfWork['rollback']>().returns.toEqualTypeOf<Promise<void>>();
    });
  })
});
