import type { ValidationRule } from "./validation-rule";

export const rule = <Type extends ValidationRule<any>>(r: Type): Type => r;
