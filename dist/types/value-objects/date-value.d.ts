import { ValueObject } from "./value-object";
export declare abstract class DateValue implements ValueObject {
    readonly valueType = "Date";
    readonly value: Date;
    readonly beforeDate: Date | undefined;
    readonly afterDate: Date | undefined;
    constructor(value: Date, beforeDate?: Date, afterDate?: Date);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=date-value.d.ts.map