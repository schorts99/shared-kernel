import type { HTTPProvider } from "./http-provider";
import type { HTTPInterceptor } from "./http-interceptor";
export declare class FetchHTTPProvider implements HTTPProvider {
    private ongoingRequests;
    private readonly init;
    private readonly getAuthorization;
    private readonly interceptors;
    constructor(getAuthorization?: () => string, init?: {
        credentials?: RequestCredentials;
        headers?: HeadersInit;
    });
    useInterceptor(interceptor: HTTPInterceptor): void;
    get<ResponseType, RequestBodySchema = undefined>(url: URL, body?: RequestBodySchema): Promise<ResponseType>;
    post<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
    put<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
    patch<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
    delete<ResponseType, RequestBodySchema = undefined>(url: URL, body?: RequestBodySchema): Promise<ResponseType>;
    private request;
    private generateRequestKey;
    private hashString;
}
//# sourceMappingURL=fetch-http-provider.d.ts.map