import { expectTypeOf } from "expect-type";

import { StateManager } from "../../src/state-manager";

type Schema = {
  name: string;
};

describe("StateManager", () => {
  it('should have a "state" property of the provided Schema', () => {
    expectTypeOf<StateManager<Schema>["state"]>().toEqualTypeOf<Schema>();
  });

  it('should have a "listeners" property of type Array<(state: Schema) => void>', () => {
    expectTypeOf<StateManager<Schema>["listeners"]>().toEqualTypeOf<Array<(state: Schema) => void>>();
  });

  describe('#getValue', () => {
    it('should define the function', () => {
      expectTypeOf<StateManager<Schema>["getValue"]>().toBeFunction();
    });

    it('should receive a key of Schema', () => {
      expectTypeOf<StateManager<Schema>["getValue"]>().parameters.toEqualTypeOf<[keyof Schema]>();
    });

    it('should return a Promise with a value from the Schema', () => {
      expectTypeOf<StateManager<Schema>["getValue"]>().returns.toEqualTypeOf<Promise<Schema[keyof Schema]>>();
    });
  });

  describe('#setValue', () => {
    it('should define the function', () => {
      expectTypeOf<StateManager<Schema>["setValue"]>().toBeFunction();
    });

    it('should receive a key of Schema and the value to set', () => {
      expectTypeOf<StateManager<Schema>["setValue"]>().parameters.toEqualTypeOf<[keyof Schema, Schema[keyof Schema]]>();
    });

    it('should return a void Promise', () => {
      expectTypeOf<StateManager<Schema>["setValue"]>().returns.toEqualTypeOf<Promise<void>>();
    });
  });

  describe('#removeValue', () => {
    it('should define the function', () => {
      expectTypeOf<StateManager<Schema>["removeValue"]>().toBeFunction();
    });

    it('should receive a key of Schema', () => {
      expectTypeOf<StateManager<Schema>["removeValue"]>().parameters.toEqualTypeOf<[keyof Schema]>();
    });

    it('should return a Promise with a value from the Schema', () => {
      expectTypeOf<StateManager<Schema>["removeValue"]>().returns.toEqualTypeOf<Promise<void>>();
    });
  });

  describe('#getState', () => {
    it('should define the function', () => {
      expectTypeOf<StateManager<Schema>["getState"]>().toBeFunction();
    });

    it('should receive no params', () => {
      expectTypeOf<StateManager<Schema>["getState"]>().parameters.toEqualTypeOf<[]>();
    });

    it('should return the value with Schema as type', () => {
      expectTypeOf<StateManager<Schema>["getState"]>().returns.toEqualTypeOf<Schema>();
    });
  });

  describe('#subscribe', () => {
    it('should define the function', () => {
      expectTypeOf<StateManager<Schema>["subscribe"]>().toBeFunction();
    });

    it('should receive a function of type (state: Schema) => void', () => {
      expectTypeOf<StateManager<Schema>["subscribe"]>().parameters.toEqualTypeOf<[(state: Schema) => void]>();
    });

    it('should return a void function', () => {
      expectTypeOf<StateManager<Schema>["subscribe"]>().returns.toEqualTypeOf<() => void>();
    });
  });

  describe('#notifyListeners', () => {
    it('should define the function', () => {
      expectTypeOf<StateManager<Schema>["notifyListeners"]>().toBeFunction();
    });

    it('should receive no params', () => {
      expectTypeOf<StateManager<Schema>["notifyListeners"]>().parameters.toEqualTypeOf<[]>();
    });

    it('should return a void function', () => {
      expectTypeOf<StateManager<Schema>["notifyListeners"]>().returns.toEqualTypeOf<void>();
    });
  });
});
