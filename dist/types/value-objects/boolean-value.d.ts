import { ValueObject } from "./";
export declare abstract class BooleanValue implements ValueObject {
    readonly valueType = "Boolean";
    readonly value: boolean;
    constructor(value: boolean);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=boolean-value.d.ts.map