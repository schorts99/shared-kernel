import { ValueObject } from "./value-object";
type Primitive = string | number | boolean | null | undefined;
export type ValidationRule<Type> = {
    required: true;
} | {
    greater_than: number;
} | {
    less_than: number;
} | {
    type: "string" | "number" | "boolean";
} | {
    custom: (value: Type) => boolean;
};
type ObjectSchema<Type> = {
    [Key in keyof Type]?: Type[Key] extends Primitive ? ValidationRule<Type[Key]>[] : ObjectSchema<Type[Key]>;
};
export declare abstract class ArrayValue<Type = any> implements ValueObject {
    readonly valueType = "Array";
    readonly value: Type[];
    readonly schema: ObjectSchema<Type> | ValidationRule<Type>[];
    abstract readonly attributeName: string;
    abstract readonly isPrimitive: boolean;
    constructor(value: Type[], schema: ObjectSchema<Type> | ValidationRule<Type>[]);
    get isValid(): boolean;
    private validateObject;
    private validateRule;
    equals(valueObject: unknown): boolean;
    private deepFreeze;
}
export {};
//# sourceMappingURL=array-value.d.ts.map