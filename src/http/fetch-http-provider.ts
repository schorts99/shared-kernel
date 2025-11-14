import type { HTTPProvider } from "./http-provider";
import { HTTPException } from "./exceptions";
import type { HTTPInterceptor } from "./http-interceptor";

export class FetchHTTPProvider implements HTTPProvider {
  private ongoingRequests = new Map<string, Promise<any>>();
  private readonly init: {
    credentials?: RequestCredentials;
    headers?: HeadersInit;
  } | undefined;
  private readonly getAuthorization: (() => string) | undefined;
  private readonly interceptors: HTTPInterceptor[] = [];

  constructor(
    getAuthorization?: () => string,
    init?: {
      credentials?: RequestCredentials;
      headers?: HeadersInit;
    }
  ) {
    this.getAuthorization = getAuthorization;
    this.init = init;
  }

  useInterceptor(interceptor: HTTPInterceptor) {
    this.interceptors.push(interceptor);
  }

  get<ResponseType, RequestBodySchema = undefined>(url: URL, body?: RequestBodySchema): Promise<ResponseType> {
    return this.request("GET", url, body);
  }

  post<RequestBodySchema, ResponseType>(
    url: URL,
    body: RequestBodySchema
  ): Promise<ResponseType> {
    return this.request("POST", url, body);
  }

  put<RequestBodySchema, ResponseType>(
    url: URL,
    body: RequestBodySchema
  ): Promise<ResponseType> {
    return this.request("PUT", url, body);
  }

  patch<RequestBodySchema, ResponseType>(
    url: URL,
    body: RequestBodySchema
  ): Promise<ResponseType> {
    return this.request("PATCH", url, body);
  }

  delete<ResponseType, RequestBodySchema = undefined>(url: URL, body?: RequestBodySchema): Promise<ResponseType> {
    return this.request("DELETE", url, body);
  }

  private async request<ResponseType>(
    method: string,
    url: URL,
    body?: unknown
  ): Promise<ResponseType> {
    const key = this.generateRequestKey(method, url, body);

    if (this.ongoingRequests.has(key)) {
      return this.ongoingRequests.get(key) as Promise<ResponseType>;
    }

    const baseHeaders = this.init?.headers ?? {};
    const authHeader = this.getAuthorization ? { Authorization: this.getAuthorization() } : {};
    const contentTypeHeader = body !== undefined ? { "Content-Type": "application/json" } : {};

    const headers: HeadersInit = {
      ...baseHeaders,
      ...contentTypeHeader,
      ...authHeader,
    };

    let init: RequestInit = {
      method,
      body: body !== undefined ? JSON.stringify(body) : null,
      headers,
    };
    
    if (this.init?.credentials !== undefined) {
      init.credentials = this.init.credentials;
    }

    for (const interceptor of this.interceptors) {
      init = interceptor.intercept(init, url);
    }

    const request = (async () => {
      const response = await fetch(url.href, init);

      if (!response) {
        throw new HTTPException(0, undefined);
      }

      if (response.status === 204) {
        return undefined as ResponseType;
      }

      const contentType = response.headers.get("Content-Type") ?? "";
      let parsed: any;

      try {
        if (contentType.includes("application/json")) {
          parsed = await response.json();
        } else if (contentType.includes("text/")) {
          parsed = await response.text();
        } else {
          parsed = await response.blob();
        }
      } catch {
        parsed = undefined;
      }

      if (!response.ok) {
        throw new HTTPException(response.status, parsed);
      }

      return parsed as ResponseType;
    })().finally(() => {
      this.ongoingRequests.delete(key);
    });

    this.ongoingRequests.set(key, request);

    return request;
  }

  private generateRequestKey(method: string, url: URL, body?: unknown): string {
    const base = `${method}:${url.href}`;
    const bodyHash = body !== undefined ? this.hashString(JSON.stringify(body)) : "";

    return `${base}:${bodyHash}`;
  }

  private hashString(input: string): string {
    let hash = 0;

    for (let i = 0; i < input.length; i++) {
      const chr = input.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }

    return hash.toString();
  }
}
