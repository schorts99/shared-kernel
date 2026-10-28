import { Operator } from "./operator.js";

export type Filter = { field: string; operator: Operator; value: any };
export type Filters = Array<Filter>;
