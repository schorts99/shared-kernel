import { Order } from "./order";
import { Operator } from "./operator";
import { Direction } from "./direction";
import { OffsetNotValid, LimitNotValid } from "./exceptions";

export class Criteria {
  constructor(
    readonly filters: Array<{ field: string; operator: Operator; value: any }> = [],
    readonly orders: Array<Order> = [],
    readonly limit?: number,
    readonly offset?: number,
  ) { }

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
    if (limit < 1) {
      throw new LimitNotValid(limit);
    }

    return new Criteria(this.filters, this.orders, limit, this.offset);
  }

  offsetResults(offset: number): Criteria {
    if (offset < 1) {
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
}

