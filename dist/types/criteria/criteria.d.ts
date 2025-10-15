import { Order } from "./order";
import { Operator } from "./operator";
import { Direction } from "./direction";
export declare class Criteria {
    readonly filters: Array<{
        field: string;
        operator: Operator;
        value: any;
    }>;
    readonly orders: Array<Order>;
    limit?: number;
    offset?: number;
    where(field: string, operator: Operator, value: any): Criteria;
    orderBy(field: string, direction?: Direction): Criteria;
    limitResults(limit: number): Criteria;
    offsetResults(offset: number): Criteria;
}
//# sourceMappingURL=criteria.d.ts.map