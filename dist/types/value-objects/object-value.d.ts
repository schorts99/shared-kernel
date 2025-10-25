import { ValueObject } from "./value-object";
type Primitive = string | number | boolean | null | undefined;
export type ValidationRule<Type> = {
    required: true;
} | {
    greater_than: number;
} | {
    greater_than_or_equal: number;
} | {
    less_than: number;
} | {
    less_than_or_equal: number;
} | {
    type: "string" | "number" | "boolean";
} | {
    enum: Array<string>;
} | {
    custom: (value: Type) => boolean;
};
export type ObjectSchema<Type> = {
    [Key in keyof Type]?: Type[Key] extends Primitive ? ValidationRule<Type[Key]>[] : ObjectSchema<Type[Key]>;
};
export declare abstract class ObjectValue<Type = any> implements ValueObject {
    readonly valueType = "Object";
    readonly value: Type;
    readonly schema: ObjectSchema<Type>;
    abstract readonly attributeName: string;
    constructor(value: Type, schema: ObjectSchema<Type>);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    private validateObject;
    private validateRule;
    private deepFreeze;
}
export {};
//# sourceMappingURL=object-value.d.ts.map