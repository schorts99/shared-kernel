import { ValueObject } from "./";
export declare abstract class PhoneValue implements ValueObject {
    readonly valueType = "Phone";
    readonly value: string;
    constructor(value: string);
    get isValid(): boolean;
    get countryCode(): string | null;
    get phoneNumber(): string | null;
    get formattedPhone(): string | null;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=phone-value.d.ts.map