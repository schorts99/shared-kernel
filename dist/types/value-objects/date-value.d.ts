import { ValueObject } from "./value-object";
type DateInput<Required extends boolean> = Required extends true ? Date : Date | null;
export declare abstract class DateValue<Required extends boolean = true> implements ValueObject {
    readonly valueType = "Date";
    readonly value: DateInput<Required>;
    readonly beforeDate: Date | undefined;
    readonly afterDate: Date | undefined;
    private readonly optional;
    constructor(value: DateInput<Required>, beforeDate?: Date, afterDate?: Date, optional?: boolean);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
export {};
//# sourceMappingURL=date-value.d.ts.map