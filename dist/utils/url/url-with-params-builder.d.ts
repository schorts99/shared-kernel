export declare class URLWithParamsBuilder {
    private readonly base;
    constructor(base: URL);
    with(params: Record<string, string | number | boolean | Array<string | number>>): URLWithParamsBuilder;
    build(): URL;
}
//# sourceMappingURL=url-with-params-builder.d.ts.map