import { ValueObject } from "./";
export declare abstract class StringValue implements ValueObject {
    readonly valueType = "String";
    readonly value: string;
    readonly minLength: number;
    readonly maxLength: number | undefined;
    constructor(value: string, minLength?: number, maxLength?: number);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=string-value.d.ts.map