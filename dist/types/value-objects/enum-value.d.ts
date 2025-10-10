import { ValueObject } from './';
export declare abstract class EnumValue<Type extends string> implements ValueObject {
    readonly valueType = "Enum";
    readonly allowedValues: Type[];
    readonly optional: boolean;
    readonly value: Type | null;
    constructor(allowedValues: Type[], value: Type | null, optional?: boolean);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=enum-value.d.ts.map