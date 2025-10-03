import type { HTTPProvider } from "./http-provider";
export declare class FetchHTTPProvider implements HTTPProvider {
    private ongoingRequests;
    private readonly init;
    private readonly getAuthorization;
    constructor(getAuthorization?: () => string, init?: Pick<RequestInit, "credentials" | "headers">);
    get<ResponseType>(url: URL): Promise<ResponseType>;
    post<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
    put<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
    patch<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
    delete<ResponseType>(url: URL): Promise<ResponseType>;
    private request;
    private generateRequestKey;
    private hashString;
}
//# sourceMappingURL=fetch-http-provider.d.ts.map