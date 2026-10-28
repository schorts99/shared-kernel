import type { ValidationRule } from "./validation-rule.js";

export const rule = <Type extends ValidationRule<any>>(r: Type): Type => r;
