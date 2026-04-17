export interface HTTPRequestOptions<T = any> {
  body?: T;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

export interface HTTPProvider {
  get<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  post<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  put<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  patch<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
  delete<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R>;
}
