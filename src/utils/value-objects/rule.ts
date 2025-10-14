import { ValidationRule } from "../../value-objects/array-value";

export const rule = <Type extends ValidationRule<any>>(r: Type): Type => r;
