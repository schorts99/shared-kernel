import { ValueObject } from './';
export declare abstract class EnumValue<Type extends string | null> implements ValueObject {
    readonly valueType = "Enum";
    readonly allowedValues: Type[];
    readonly value: Type;
    constructor(allowedValues: Type[], value: Type);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=enum-value.d.ts.map