import { ValueObject } from "./";
export declare abstract class SlugValue implements ValueObject {
    readonly valueType = "Slug";
    readonly value: string;
    constructor(value: string);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=slug-value.d.ts.map