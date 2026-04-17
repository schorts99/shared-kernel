export interface HTTPInterceptor {
  request?(init: RequestInit, url: URL): RequestInit | Promise<RequestInit>;
  response?(response: Response): Response | Promise<Response>;
  error?(error: Error): Error | Promise<Error>;
}
