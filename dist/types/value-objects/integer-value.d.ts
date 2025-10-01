import { ValueObject } from "./";
export declare abstract class IntegerValue implements ValueObject {
    readonly valueType = "Integer";
    readonly min: number | undefined;
    readonly max: number | undefined;
    readonly value: number;
    constructor(value: number, min?: number, max?: number);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=integer-value.d.ts.map