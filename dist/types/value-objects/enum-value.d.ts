import { ValueObject } from "./value-object";
export declare abstract class EnumValue<Allowed extends readonly (string | null)[]> implements ValueObject {
    readonly valueType = "Enum";
    readonly allowedValues: Allowed;
    readonly value: Allowed[number];
    constructor(allowedValues: Allowed, value: Allowed[number]);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=enum-value.d.ts.map