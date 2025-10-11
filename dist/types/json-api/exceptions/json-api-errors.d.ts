export declare class JSONAPIErrors extends Error {
    readonly errors: Array<{
        id?: string;
        status: string;
        code: string;
        title: string;
        detail: string;
        source?: {
            pointer: string;
        } | {
            parameter: string;
        } | {
            header: string;
        };
        meta?: Record<string, any>;
    }>;
    constructor(errors: JSONAPIErrors["errors"]);
}
//# sourceMappingURL=json-api-errors.d.ts.map