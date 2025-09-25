import { expectTypeOf } from "expect-type";

import { HTTPProvider } from "../../src/http";

describe('HTTPProvider', () => {
  describe('#get', () => {
    it('should receive an URL', () => {
      expectTypeOf<HTTPProvider["get"]>().parameters.toEqualTypeOf<[URL]>();
    });

    it('should return a Promise<ResponseType>', () => {
      expectTypeOf<HTTPProvider["get"]>().returns.toEqualTypeOf<Promise<unknown>>();
    });
  });

  describe('#post', () => {
    it('should receive an URL and a body', () => {
      expectTypeOf<HTTPProvider["post"]>().parameters.toEqualTypeOf<[URL, unknown]>();
    });

    it('should return a Promise<ResponseType>', () => {
      expectTypeOf<HTTPProvider["post"]>().returns.toEqualTypeOf<Promise<unknown>>();
    });
  });

  describe('#put', () => {
    it('should receive an URL and a body', () => {
      expectTypeOf<HTTPProvider["put"]>().parameters.toEqualTypeOf<[URL, unknown]>();
    });

    it('should return a Promise<ResponseType>', () => {
      expectTypeOf<HTTPProvider["put"]>().returns.toEqualTypeOf<Promise<unknown>>();
    });
  });

  describe('#patch', () => {
    it('should receive an URL and a body', () => {
      expectTypeOf<HTTPProvider["patch"]>().parameters.toEqualTypeOf<[URL, unknown]>();
    });

    it('should return a Promise<ResponseType>', () => {
      expectTypeOf<HTTPProvider["patch"]>().returns.toEqualTypeOf<Promise<unknown>>();
    });
  });

  describe('#delete', () => {
    it('should receive an URL', () => {
      expectTypeOf<HTTPProvider["delete"]>().parameters.toEqualTypeOf<[URL]>();
    });

    it('should return a Promise<ResponseType>', () => {
      expectTypeOf<HTTPProvider["delete"]>().returns.toEqualTypeOf<Promise<unknown>>();
    });
  });
});
