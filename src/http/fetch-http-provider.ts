import type { HTTPProvider, HTTPRequestOptions } from "./http-provider.js";
import { HTTPException } from "./exceptions/index.js";
import type { HTTPInterceptor } from "./http-interceptor.js";
import { URLWithParamsBuilder, type URLParamValue } from "../utils/index.js";

export interface FetchHTTPProviderConfig {
  baseUrl?: string | URL;
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  getAuthorization?: () => string | undefined | Promise<string | undefined>;
}

export class FetchHTTPProvider implements HTTPProvider {
  private ongoingRequests = new Map<string, Promise<unknown>>();
  private readonly interceptors: HTTPInterceptor[] = [];
  private readonly config: FetchHTTPProviderConfig;

  constructor(config: FetchHTTPProviderConfig = {}) {
    this.config = config;
  }

  useInterceptor(interceptor: HTTPInterceptor) {
    this.interceptors.push(interceptor);
  }

  get<R, B = unknown>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.request("GET", url, options);
  }

  post<R, B = unknown>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.request("POST", url, options);
  }

  put<R, B = unknown>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.request("PUT", url, options);
  }

  patch<R, B = unknown>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.request("PATCH", url, options);
  }

  delete<R, B = unknown>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.request("DELETE", url, options);
  }

  private async request<R>(
    method: string,
    url: string | URL,
    options?: HTTPRequestOptions
  ): Promise<R> {
    let cleanup = () => {};

    try {
      if (options?.timeoutMs !== undefined &&
        (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 0 || options.timeoutMs > 2_147_483_647)) {
        throw new RangeError("timeoutMs must be an integer between 0 and 2147483647");
      }

      options?.signal?.throwIfAborted();

      const fullUrl = this.buildUrl(url, options?.query);
      let init = await this.prepareRequest(method, options);

      for (const interceptor of this.interceptors) {
        if (interceptor.request) {
          init = await interceptor.request(init, fullUrl);
        }
      }

      const cancellation = this.prepareCancellation(options?.signal, init.signal, options?.timeoutMs);
      cleanup = cancellation.cleanup;

      if (cancellation.signal) {
        init.signal = cancellation.signal;
        init.signal.throwIfAborted();
      }

      const key = options?.deduplicate && method === "GET" &&
        (init.method ?? method).toUpperCase() === "GET" && !init.signal &&
        (init.body === undefined || init.body === null)
        ? this.generateRequestKey(fullUrl, init)
        : undefined;

      if (key !== undefined) {
        const ongoingRequest = this.ongoingRequests.get(key);

        if (ongoingRequest) return await ongoingRequest as R;
      }

      const requestTask = (async () => {
        let response = await fetch(fullUrl.href, init);

        for (const interceptor of this.interceptors) {
          if (interceptor.response) {
            response = await interceptor.response(response);
          }
        }

        return await this.handleResponse<R>(response);
      })();

      if (key !== undefined) this.ongoingRequests.set(key, requestTask);

      try {
        return await requestTask;
      } finally {
        if (key !== undefined) this.ongoingRequests.delete(key);
      }
    } catch (error) {
      let finalError = error instanceof Error ? error : new Error(String(error));

      for (const interceptor of this.interceptors) {
        if (interceptor.error) {
          finalError = await interceptor.error(finalError);
        }
      }

      throw finalError;
    } finally {
      cleanup();
    }
  }

  private prepareCancellation(
    callerSignal: AbortSignal | undefined,
    interceptorSignal: AbortSignal | null | undefined,
    timeoutMs: number | undefined,
  ): { signal: AbortSignal | undefined; cleanup: () => void } {
    const signals = [...new Set([callerSignal, interceptorSignal].filter(
      (signal): signal is AbortSignal => signal !== undefined && signal !== null,
    ))];

    if (signals.length === 0 && timeoutMs === undefined) {
      return { signal: undefined, cleanup: () => {} };
    }

    const controller = new AbortController();
    const listeners: Array<() => void> = [];

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        break;
      }

      const onAbort = () => controller.abort(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      listeners.push(() => signal.removeEventListener("abort", onAbort));
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!controller.signal.aborted && timeoutMs !== undefined) {
      const onTimeout = () => controller.abort(new DOMException("HTTP request timed out", "TimeoutError"));

      if (timeoutMs === 0) {
        onTimeout();
      } else {
        timer = setTimeout(onTimeout, timeoutMs);
      }
    }

    return {
      signal: controller.signal,
      cleanup: () => {
        if (timer !== undefined) clearTimeout(timer);
        listeners.forEach(removeListener => removeListener());
      },
    };
  }

  private buildUrl(url: string | URL, query?: Record<string, URLParamValue>): URL {
    let finalUrl: URL;

    if (typeof url === "string") {
      if (url.startsWith("http")) {
        finalUrl = new URL(url);
      } else {
        const base = this.config.baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost");

        finalUrl = new URL(url, base);
      }
    } else {
      finalUrl = new URL(url.href);
    }

    if (query) {
      finalUrl = new URLWithParamsBuilder(finalUrl).with(query).build();
    }

    return finalUrl;
  }

  private isNativeBodyInit(body: unknown): body is BodyInit {
    if (typeof body === "string") return true;
    if (typeof FormData !== "undefined" && body instanceof FormData) return true;
    if (typeof Blob !== "undefined" && body instanceof Blob) return true;
    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return true;
    if (typeof ArrayBuffer !== "undefined" && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) {
      return true;
    }
    if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) return true;
    return false;
  }

  private async prepareRequest(method: string, options?: HTTPRequestOptions): Promise<RequestInit> {
    const headers = new Headers(this.config.headers);

    if (options?.headers) {
      Object.entries(options.headers).forEach(([k, v]) => headers.set(k, v));
    }

    const rawBody = options?.body;
    const isNativeBody = rawBody !== undefined && rawBody !== null && this.isNativeBodyInit(rawBody);

    if (rawBody !== undefined && !isNativeBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (this.config.getAuthorization) {
      const auth = await this.config.getAuthorization();

      if (auth) headers.set("Authorization", auth);
    }

    const init: RequestInit = {
      method,
      headers,
      body:
        rawBody === undefined
          ? null
          : isNativeBody
            ? rawBody
            : JSON.stringify(rawBody),
    };

    if (this.config.credentials) {
      init.credentials = this.config.credentials;
    }

    if (options?.signal) init.signal = options.signal;

    return init;
  }


  private async handleResponse<R>(response: Response): Promise<R> {
    if (response.status === 204 || response.status === 205) {
      if (!response.ok) {
        throw new HTTPException(response.status, undefined);
      }
      return undefined as R;
    }

    const contentType = (response.headers.get("Content-Type") ?? "").split(";")[0]!.trim().toLowerCase();
    let data: unknown;

    if (contentType === "application/json" || contentType.endsWith("+json")) {
      if (typeof response.text === "function") {
        const text = await response.text();
        data = text.trim() === "" ? undefined : JSON.parse(text);
      } else {
        data = await response.json();
      }
    } else if (contentType.startsWith("text/")) {
      data = await response.text();
    } else {
      data = await response.blob();
    }

    if (!response.ok) {
      throw new HTTPException(response.status, data);
    }

    return data as R;
  }

  private generateRequestKey(url: URL, init: RequestInit): string {
    const headers: Array<[string, string]> = [];
    new Headers(init.headers).forEach((value, name) => headers.push([name, value]));

    return JSON.stringify([url.href, { ...init, headers }]);
  }
}
