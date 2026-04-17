import type { HTTPProvider, HTTPRequestOptions } from "./http-provider";
import { HTTPException } from "./exceptions";
import type { HTTPInterceptor } from "./http-interceptor";

export interface FetchHTTPProviderConfig {
  baseUrl?: string | URL;
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  getAuthorization?: () => string | undefined;
}

export class FetchHTTPProvider implements HTTPProvider {
  private ongoingRequests = new Map<string, Promise<any>>();
  private readonly interceptors: HTTPInterceptor[] = [];
  private readonly config: FetchHTTPProviderConfig;

  constructor(config: FetchHTTPProviderConfig = {}) {
    this.config = config;
  }

  useInterceptor(interceptor: HTTPInterceptor) {
    this.interceptors.push(interceptor);
  }

  get<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.request("GET", url, options);
  }

  post<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.request("POST", url, options);
  }

  put<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.request("PUT", url, options);
  }

  patch<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.request("PATCH", url, options);
  }

  delete<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.request("DELETE", url, options);
  }

  private async request<R>(
    method: string,
    url: string | URL,
    options?: HTTPRequestOptions
  ): Promise<R> {
    const fullUrl = this.buildUrl(url, options?.query);
    const key = this.generateRequestKey(method, fullUrl, options?.body);

    if (this.ongoingRequests.has(key)) {
      return this.ongoingRequests.get(key) as Promise<R>;
    }

    const requestTask = (async () => {
      try {
        let init = await this.prepareRequest(method, options);

        for (const interceptor of this.interceptors) {
          if (interceptor.request) {
            init = await interceptor.request(init, fullUrl);
          }
        }

        let response = await fetch(fullUrl.href, init);

        for (const interceptor of this.interceptors) {
          if (interceptor.response) {
            response = await interceptor.response(response);
          }
        }

        return await this.handleResponse<R>(response);
      } catch (error) {
        let finalError = error as Error;

        for (const interceptor of this.interceptors) {
          if (interceptor.error) {
            finalError = await interceptor.error(finalError);
          }
        }

        throw finalError;
      }
    })().finally(() => {
      this.ongoingRequests.delete(key);
    });

    this.ongoingRequests.set(key, requestTask);

    return requestTask;
  }

  private buildUrl(url: string | URL, query?: Record<string, any>): URL {
    let finalUrl: URL;

    if (typeof url === "string") {
      if (url.startsWith("http")) {
        finalUrl = new URL(url);
      } else {
        const base = this.config.baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost");

        finalUrl = new URL(url, base);
      }
    } else {
      finalUrl = url;
    }

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          finalUrl.searchParams.append(key, String(value));
        }
      });
    }

    return finalUrl;
  }

  private async prepareRequest(method: string, options?: HTTPRequestOptions): Promise<RequestInit> {
    const headers = new Headers(this.config.headers);

    if (options?.headers) {
      Object.entries(options.headers).forEach(([k, v]) => headers.set(k, v));
    }

    if (options?.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (this.config.getAuthorization) {
      const auth = this.config.getAuthorization();

      if (auth) headers.set("Authorization", auth);
    }

    const init: RequestInit = {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : null,
    };

    if (this.config.credentials) {
      init.credentials = this.config.credentials;
    }

    return init;
  }


  private async handleResponse<R>(response: Response): Promise<R> {
    if (response.status === 204) {
      return undefined as any;
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    let data: any;

    try {
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else if (contentType.includes("text/")) {
        data = await response.text();
      } else {
        data = await response.blob();
      }
    } catch {
      data = undefined;
    }

    if (!response.ok) {
      throw new HTTPException(response.status, data);
    }

    return data as R;
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
