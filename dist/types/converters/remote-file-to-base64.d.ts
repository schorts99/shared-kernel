import { HTTPProvider } from "../http";
export declare class RemoteFileToBase64 {
    private readonly httpProvider;
    constructor(httpProvider: HTTPProvider);
    convert(url: URL): Promise<string>;
}
//# sourceMappingURL=remote-file-to-base64.d.ts.map