import { Order } from "./order";
import { Operator } from "./operator";
import { Direction } from "./direction";
import { OffsetNotValid, LimitNotValid } from "./exceptions";
import { Filters } from "./filters";

export interface CriteriaPrimitives {
  filters: Filters;
  orders: Array<Order>;
  limit?: number | undefined;
  offset?: number | undefined;
}

export class Criteria {
  readonly filters: Filters;
  readonly orders: Array<Order>;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;

  constructor(
    filters: Filters = [],
    orders: Array<Order> = [],
    limit?: number,
    offset?: number,
  ) {
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) {
      throw new LimitNotValid(limit);
    }

    if (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0)) {
      throw new OffsetNotValid(offset);
    }

    this.filters = filters.map(filter => ({ ...filter }));
    this.orders = orders.map(order => ({ ...order }));
    this.limit = limit;
    this.offset = offset;
  }

  public static none(): Criteria {
    return new Criteria();
  }

  where(field: string, operator: Operator, value: any): Criteria {
    return new Criteria(
      [...this.filters, { field, operator, value }],
      this.orders,
      this.limit,
      this.offset,
    );
  }

  orderBy(field: string, direction: Direction = "ASC"): Criteria {
    return new Criteria(
      this.filters,
      [...this.orders, { field, direction }],
      this.limit,
      this.offset,
    );
  }

  limitResults(limit: number): Criteria {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new LimitNotValid(limit);
    }

    return new Criteria(this.filters, this.orders, limit, this.offset);
  }

  offsetResults(offset: number): Criteria {
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new OffsetNotValid(offset);
    }

    return new Criteria(this.filters, this.orders, this.limit, offset);
  }

  public hasFilters(): boolean {
    return this.filters.length > 0;
  }

  public hasOrders(): boolean {
    return this.orders.length > 0;
  }

  toPrimitives(): CriteriaPrimitives {
    return {
      filters: this.filters.map(filter => ({ ...filter })),
      orders: this.orders.map(order => ({ ...order })),
      ...(this.limit !== undefined ? { limit: this.limit } : {}),
      ...(this.offset !== undefined ? { offset: this.offset } : {}),
    };
  }

  static fromPrimitives(primitives: Partial<CriteriaPrimitives> = {}): Criteria {
    return new Criteria(
      primitives.filters ? primitives.filters.map(filter => ({ ...filter })) : [],
      primitives.orders ? primitives.orders.map(order => ({ ...order })) : [],
      primitives.limit,
      primitives.offset,
    );
  }
}
