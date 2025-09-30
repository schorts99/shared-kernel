import { expectTypeOf } from "expect-type";

import { AuthProvider } from "../../src/auth";
import { Entity } from "../../src/entities";
import { UUIDValue } from "../../src/value-objects";

type Model = {
  id: string;
  name: string;
};

class IDValue extends UUIDValue {
  attributeName = "ID";
}

class TestUser extends Entity<IDValue, Model> {
  toPrimitives(): Model {
    return {
      id: this.id.toString(),
      name: "test",
    };
  }
}

describe('AuthProvider', () => {
  it('should declare an "authenticate" method', () => {
    expectTypeOf<AuthProvider<TestUser>['authenticate']>().toBeFunction();
    expectTypeOf<AuthProvider<TestUser>['authenticate']>().returns.toEqualTypeOf<Promise<void>>();
  });

  it('should declare a "logout" method', () => {
    expectTypeOf<AuthProvider<TestUser>['logout']>().toBeFunction();
    expectTypeOf<AuthProvider<TestUser >['logout']>().returns.toEqualTypeOf<Promise<void>>();
  });

  it('should declare a "isAuthenticated" method', () => {
    expectTypeOf<AuthProvider<TestUser>['isAuthenticated']>().toBeFunction();
    expectTypeOf<AuthProvider<TestUser>['isAuthenticated']>().returns.toEqualTypeOf<Promise<boolean>>();
  });

  it('should declare a "currentUser" method', () => {
    expectTypeOf<AuthProvider<TestUser>['currentUser']>().toBeFunction();
    expectTypeOf<AuthProvider<TestUser>['currentUser']>().returns.toEqualTypeOf<Promise<TestUser  | null>>();
  });

  it('should declare a "onAuthChange" method', () => {
    expectTypeOf<AuthProvider<TestUser>['onAuthChange']>().toBeFunction();
    expectTypeOf<AuthProvider<TestUser>['onAuthChange']>().returns.toEqualTypeOf<() => void>();
  });
});
