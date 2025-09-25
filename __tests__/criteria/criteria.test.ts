import { expectTypeOf } from "expect-type";

import {
  Criteria,
  FilterCriterion,
  Order,
  Operator,
  Direction,
  PaginationNotValid,
  OffsetNotValid,
  LimitNotValid,
} from "../../src/criteria";

describe('Criteria', () => {
  describe('filters', () => {
    it('should be defined', () => {
      expectTypeOf<Criteria>().toHaveProperty("filters");
    });

    it('should be of type Record<string, FilterCriterion>', () => {
      expectTypeOf<Criteria["filters"]>().toEqualTypeOf<Record<string, FilterCriterion>>();
    });

    it('should be empty', () => {
      const criteria = new Criteria();
      const filters = criteria.filters;
      const filterKeys = Object.keys(filters);

      expect(filterKeys).toHaveLength(0);
    });
  });

  describe('orders', () => {
    it('should be defined', () => {
      expectTypeOf<Criteria>().toHaveProperty("orders");
    });

    it('should be of type Array<Order>', () => {
      expectTypeOf<Criteria["orders"]>().toEqualTypeOf<Array<Order>>();
    });

    it('should be empty', () => {
      const criteria = new Criteria();
      const orders = criteria.orders;

      expect(orders).toHaveLength(0);
    });
  });

  it('should have a "limit" property of type number or undefined', () => {
    expectTypeOf<Criteria>().toHaveProperty("limit");
    expectTypeOf<Criteria["limit"]>().toEqualTypeOf<number | undefined>();
  });

  it('should have a "offset" property of type number or undefined', () => {
    expectTypeOf<Criteria>().toHaveProperty("offset");
    expectTypeOf<Criteria["offset"]>().toEqualTypeOf<number | undefined>();
  });

  describe('#where', () => {
    it('should receive field, operator and value', () => {
      expectTypeOf<Criteria["where"]>().parameters.toEqualTypeOf<[string, Operator, any]>();
    });

    it('should return the same instance', () => {
      const criteria = new Criteria();
      const result = criteria.where('field', 'EQUAL', 'value');

      expect(result).toEqual(criteria);
    });

    it('should add the filter to the "filters" property', () => {
      const criteria = new Criteria();
      const result = criteria.where('field', 'EQUAL', 'value');
      const filters = result.filters;
      const expectedFilters = { field: { value: "value", operator: "EQUAL" } };

      expect(filters["field"]).toBeDefined();
      expect(filters).toEqual(expectedFilters);
    });
  });

  describe('#orderBy', () => {
    it('should receive field and direction', () => {
      expectTypeOf<Criteria["orderBy"]>().parameters.toEqualTypeOf<[string, Direction?]>();
    });

    it('should return the same instance', () => {
      const criteria = new Criteria();
      const result = criteria.orderBy('field', 'DESC');

      expect(result).toEqual(criteria);
    });

    it('should add the order to the "orders" property', () => {
      const criteria = new Criteria();
      const result = criteria.orderBy("field", "DESC");
      const orders = result.orders;
      const expectedOrders = [{ field: "field", direction: "DESC" }];

      expect(orders).toHaveLength(1);
      expect(orders).toEqual(expectedOrders);
    });
  });

  describe('#paginate', () => {
    it('should receive a page and perPage', () => {
      expectTypeOf<Criteria["paginate"]>().parameters.toEqualTypeOf<[number, number]>();
    });

    it('should return the same instance', () => {
      const criteria = new Criteria();
      const result = criteria.paginate(1, 1);

      expect(result).toEqual(criteria);
    });

    it('should set the "limit" and "offset" properties', () => {
      const criteria = new Criteria();
      const page = 1;
      const perPage = 1;
      const result = criteria.paginate(page, perPage);

      expect(result.offset).toBeDefined();
      expect(result.limit).toBeDefined();
      expect(result.limit).toEqual(perPage);
      expect(result.offset).toEqual((page - 1) * perPage);
    });

    it('throws a PaginationNotValid if page < 1', () => {
      const criteria = new Criteria();
  
      expect(() => criteria.paginate(-1, 1)).toThrow(PaginationNotValid);
    });

    it('throws a PaginationNotValid if perPage < 1', () => {
      const criteria = new Criteria();
  
      expect(() => criteria.paginate(-1, 0)).toThrow(PaginationNotValid)
    });
  });

  describe('#limitResults', () => {
    it('should receive a number', () => {
      expectTypeOf<Criteria["limitResults"]>().parameters.toEqualTypeOf<[number]>();
    });

    it('should return the same instance', () => {
      const criteria = new Criteria();
      const result = criteria.limitResults(1);

      expect(result).toEqual(criteria);
    });

    it('should assign the value to the "limit" property', () => {
      const criteria = new Criteria();
      const limit = 1;
      const result = criteria.limitResults(limit);

      expect(result.limit).toEqual(limit);
    });

    it('should throw an LimitNotValid exception if value is less than 1', () => {
      const criteria = new Criteria();

      expect(() => criteria.limitResults(0)).toThrow(LimitNotValid);
    });
  });

  describe('#offsetResults', () => {
    it('should receive a number', () => {
      expectTypeOf<Criteria["offsetResults"]>().parameters.toEqualTypeOf<[number]>();
    });

    it('should return the same instance', () => {
      const criteria = new Criteria();
      const result = criteria.offsetResults(1);

      expect(result).toEqual(criteria);
    });

    it('should assign the value to the "offset" property', () => {
      const criteria = new Criteria();
      const offset = 1;
      const result = criteria.offsetResults(offset);

      expect(result.offset).toEqual(offset);
    });

    it('should throw an OffsetNotValid exception if value is less than 1', () => {
      const criteria = new Criteria();

      expect(() => criteria.offsetResults(0)).toThrow(OffsetNotValid);
    });
  });
});
