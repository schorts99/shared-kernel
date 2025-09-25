import { expectTypeOf } from "expect-type";

import { URLWithParamsBuilder } from "../../../src/utils";

const baseURL = 'https://github.com/schorts99';
const url = new URL(baseURL);

describe('URLWithParamsBuilder', () => {
  it('should have a "base" property of type URL', () => {
    expectTypeOf<URLWithParamsBuilder["base"]>().toEqualTypeOf<URL>();
  });

  describe('#with', () => {
    it('should receive a params with type Record<string, string | number | boolean | string[] | number[]>', () => {
      expectTypeOf<URLWithParamsBuilder["with"]>().parameters.toEqualTypeOf<[Record<string, string | number | boolean | string[] | number[]>]>();
    });

    it('should return the same instance', () => {
      const uRLWithParamsBuilder = new URLWithParamsBuilder(url);
      const result = uRLWithParamsBuilder.with({ page: 1 });

      expect(result).toEqual(uRLWithParamsBuilder);
    });
  });

  describe('#build', () => {
    it('should receive no params', () => {
      expectTypeOf<URLWithParamsBuilder["build"]>().parameters.toEqualTypeOf<[]>();
    });

    it('should return the updated url', () => {
      const uRLWithParamsBuilder = new URLWithParamsBuilder(url);
      const expectedURL = new URL(`${baseURL}?page=1`);
      const result = uRLWithParamsBuilder.with({ page: 1 }).build();

      expect(result.href).toEqual(expectedURL.href);
    });
  });
});
