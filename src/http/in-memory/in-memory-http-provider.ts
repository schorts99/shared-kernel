import { cloneValue, URLWithParamsBuilder } from "../../utils/index.js";
import { HTTPException } from "../exceptions/index.js";
import type { HTTPProvider, HTTPRequestOptions } from "../http-provider.js";

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RecordedHTTPRequest<B = any> {
  method: HTTPMethod;
  url: URL;
  options?: HTTPRequestOptions<B> | undefined;
  timestamp: Date;
}

export type HTTPRouteMatcher = string | URL | RegExp | ((url: URL) => boolean);

export type HTTPRouteHandler<R = any, B = any> =
  | R
  | ((request: RecordedHTTPRequest<B>) => R | Promise<R>);

interface RegisteredRoute {
  method: HTTPMethod | "*";
  matcher: HTTPRouteMatcher;
  handler: HTTPRouteHandler;
}

export interface InMemoryHTTPProviderOptions {
  baseUrl?: string | URL;
}

export class InMemoryHTTPProvider implements HTTPProvider {
  private readonly routes: RegisteredRoute[] = [];
  private readonly requests: RecordedHTTPRequest[] = [];
  private readonly baseUrl: string | URL;

  constructor(options: InMemoryHTTPProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://localhost";
  }

  on<R = any, B = any>(
    method: HTTPMethod | "*",
    matcher: HTTPRouteMatcher,
    handler: HTTPRouteHandler<R, B>,
  ): this {
    this.routes.push({
      method,
      matcher,
      handler,
    });
    return this;
  }

  get<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.execute("GET", url, options);
  }

  post<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.execute("POST", url, options);
  }

  put<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.execute("PUT", url, options);
  }

  patch<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.execute("PATCH", url, options);
  }

  delete<R, B = any>(url: string | URL, options?: HTTPRequestOptions<B>): Promise<R> {
    return this.execute("DELETE", url, options);
  }

  getRequests(): RecordedHTTPRequest[] {
    return this.requests.map(req => ({
      ...req,
      url: new URL(req.url.toString()),
      timestamp: new Date(req.timestamp.getTime()),
    }));
  }

  clearRequests(): void {
    this.requests.length = 0;
  }

  clearRoutes(): void {
    this.routes.length = 0;
  }

  clear(): void {
    this.clearRequests();
    this.clearRoutes();
  }

  private async execute<R, B = any>(
    method: HTTPMethod,
    url: string | URL,
    options?: HTTPRequestOptions<B>,
  ): Promise<R> {
    options?.signal?.throwIfAborted();

    const fullUrl = this.buildUrl(url, options);
    const recorded: RecordedHTTPRequest<B> = {
      method,
      url: fullUrl,
      options: this.cloneOptions(options),
      timestamp: new Date(),
    };
    this.requests.push(recorded);

    for (let i = this.routes.length - 1; i >= 0; i--) {
      const route = this.routes[i]!;
      if (route.method !== "*" && route.method !== method) {
        continue;
      }

      if (this.matchesUrl(route.matcher, fullUrl)) {
        if (typeof route.handler === "function") {
          return await (route.handler as (req: RecordedHTTPRequest<B>) => R | Promise<R>)(recorded);
        }
        return this.safeClone(route.handler) as R;
      }
    }

    throw new HTTPException(404, {
      message: `No route stubbed for ${method} ${fullUrl.href}`,
    });
  }

  private buildUrl(url: string | URL, options?: HTTPRequestOptions): URL {
    let resolved: URL;
    if (typeof url === "string") {
      resolved = url.startsWith("http") ? new URL(url) : new URL(url, this.baseUrl);
    } else {
      resolved = new URL(url.toString());
    }

    if (options?.query) {
      resolved = new URLWithParamsBuilder(resolved).with(options.query).build();
    }

    return resolved;
  }

  private matchesUrl(matcher: HTTPRouteMatcher, url: URL): boolean {
    if (typeof matcher === "function") {
      return matcher(url);
    }
    if (matcher instanceof RegExp) {
      return matcher.test(url.href) || matcher.test(url.pathname);
    }
    if (matcher instanceof URL) {
      return matcher.href === url.href;
    }
    const targetUrl = matcher.startsWith("http")
      ? new URL(matcher)
      : new URL(matcher, this.baseUrl);
    if (matcher.includes("?")) {
      return targetUrl.href === url.href;
    }
    return targetUrl.origin === url.origin && targetUrl.pathname === url.pathname;
  }

  private cloneOptions<B>(options?: HTTPRequestOptions<B>): HTTPRequestOptions<B> | undefined {
    if (!options) return undefined;
    const cloned: HTTPRequestOptions<B> = {};
    if (options.body !== undefined) {
      cloned.body = this.safeClone(options.body);
    }
    if (options.query !== undefined) {
      cloned.query = this.safeClone(options.query);
    }
    if (options.headers !== undefined) {
      cloned.headers = { ...options.headers };
    }
    if (options.deduplicate !== undefined) {
      cloned.deduplicate = options.deduplicate;
    }
    if (options.signal !== undefined) {
      cloned.signal = options.signal;
    }
    if (options.timeoutMs !== undefined) {
      cloned.timeoutMs = options.timeoutMs;
    }
    return cloned;
  }

  private safeClone<T>(value: T): T {
    try {
      return cloneValue(value);
    } catch {
      return value;
    }
  }
}
