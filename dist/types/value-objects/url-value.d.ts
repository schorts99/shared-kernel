import type { ValueObject } from "./";
export declare abstract class URLValue implements ValueObject {
    readonly valueType = "URL";
    readonly value: URL;
    readonly allowedHosts: Array<string>;
    constructor(value: URL, allowedHosts?: Array<string>);
    get isValid(): boolean;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=url-value.d.ts.map