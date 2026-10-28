import type { URLParamValue } from "../utils";

export interface HTTPRequestOptions<T = any> {
  body?: T;
  query?: Record<string, URLParamValue>;
  headers?: Record<string, string>;
  deduplicate?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface HTTPProvider {
  get<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  post<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  put<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  patch<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  delete<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
}
