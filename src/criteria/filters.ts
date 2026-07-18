import { Operator } from "./operator";

export type Filter = { field: string; operator: Operator; value: any };
export type Filters = Array<Filter>;
