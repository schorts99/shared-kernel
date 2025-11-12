import { Criteria } from "../criteria";
export declare class URLCriteriaParser {
    private readonly url;
    private readonly allowedKeys;
    constructor(url: URL, allowedKeys?: Array<string>);
    parse(): Criteria;
    private mapOperator;
    private parseValue;
}
//# sourceMappingURL=url-criteria-parser.d.ts.map