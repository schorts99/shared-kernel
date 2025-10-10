import { ValueObject } from "./value-object";
export declare abstract class FloatValue implements ValueObject {
    readonly valueType = "Float";
    readonly value: number;
    readonly decimals: number | undefined;
    constructor(value: number, decimals?: number);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
    private transform;
}
//# sourceMappingURL=float-valuet.d.ts.map