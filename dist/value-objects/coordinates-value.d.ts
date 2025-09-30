import { ValueObject } from "./";
export declare abstract class CoordinatesValue implements ValueObject {
    readonly valueType = "Coordinates";
    readonly value: {
        latitude: number;
        longitude: number;
    };
    constructor(value: CoordinatesValue["value"]);
    get isValid(): boolean;
    get latitude(): number | null;
    get longitude(): number | null;
    equals(valueObject: unknown): boolean;
    abstract readonly attributeName: string;
}
//# sourceMappingURL=coordinates-value.d.ts.map