import { ValueObject } from "./";
export declare abstract class EnumValue implements ValueObject {
    readonly valueType = "Enum";
    readonly allowedValues: Array<string>;
    readonly value: typeof this.allowedValues[number] | string;
    constructor(allowedValues: Array<string>, value: string);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=enum-value.d.ts.map