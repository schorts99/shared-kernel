export interface HTTPInterceptor {
  intercept(init: RequestInit, url: URL): RequestInit;
}
