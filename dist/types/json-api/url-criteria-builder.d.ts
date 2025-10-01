import { Criteria } from "../criteria";
export declare class URLCriteriaBuilder {
    private readonly base;
    private readonly criteria?;
    private readonly include?;
    constructor(base: URL, criteria?: Criteria | undefined, include?: string[] | undefined);
    build(): URL;
}
//# sourceMappingURL=url-criteria-builder.d.ts.map