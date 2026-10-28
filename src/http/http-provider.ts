import type { URLParamValue } from "../utils/index.js";

export interface HTTPRequestOptions<T = unknown> {
  body?: T;
  query?: Record<string, URLParamValue>;
  headers?: Record<string, string>;
  deduplicate?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface HTTPProvider {
  get<R, B = unknown>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  post<R, B = unknown>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  put<R, B = unknown>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  patch<R, B = unknown>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  delete<R, B = unknown>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
}
