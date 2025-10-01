import { ValueObject } from "./";
export declare abstract class EmailValue implements ValueObject {
    readonly valueType = "Email";
    readonly value: string;
    constructor(value: string);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=email-value.d.ts.map