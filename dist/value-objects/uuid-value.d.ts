import type { ValueObject } from "./";
type UUIDInput<Required extends boolean> = Required extends true ? string : string | undefined;
export declare abstract class UUIDValue<Required extends boolean = true> implements ValueObject {
    readonly valueType = "UUID";
    readonly value: UUIDInput<Required>;
    private readonly optional;
    constructor(value: UUIDInput<Required>, optional?: boolean);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
export {};
//# sourceMappingURL=uuid-value.d.ts.map