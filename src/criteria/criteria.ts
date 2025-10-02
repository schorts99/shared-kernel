import { FilterCriterion } from "./filter-criterion";
import { Order } from "./order";
import { Operator } from "./operator";
import { Direction } from "./direction";
import { OffsetNotValid, LimitNotValid } from "./exceptions";

export class Criteria {
  readonly filters: Record<string, FilterCriterion> = {};
  readonly orders: Array<Order> = [];
  limit?: number;
  offset?: number;

  where(
    field: string,
    operator: Operator,
    value: any,
  ): Criteria {
    this.filters[field] = { value, operator };

    return this;
  }

  orderBy(
    field: string,
    direction: Direction = "ASC",
  ): Criteria {
    this.orders.push({ field, direction });

    return this;
  }

  limitResults(limit: number): Criteria {
    if (limit < 1) {
      throw new LimitNotValid(limit);
    }

    this.limit = limit;

    return this;
  }

  offsetResults(offset: number): Criteria {
    if (offset < 1) {
      throw new OffsetNotValid(offset);
    }

    this.offset = offset;

    return this;
  }
}
