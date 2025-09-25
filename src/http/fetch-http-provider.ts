import type { HTTPProvider } from "./http-provider";
import { HTTPException } from "./exceptions";

export class FetchHTTPProvider implements HTTPProvider {
  private ongoingRequests = new Map<string, Promise<any>>();

  get<ResponseType>(url: URL): Promise<ResponseType> {
    return this.request("GET", url);
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

  delete<ResponseType>(url: URL): Promise<ResponseType> {
    return this.request("DELETE", url);
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

    const init: RequestInit = {
      method,
      body: body !== undefined ? JSON.stringify(body) : null,
    };

    if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
    }

    const request = (async () => {
      const response = await fetch(url.href, init);

      if (!response) {
        throw new HTTPException("Fetch returned undefined", 0);
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
        const message =
          typeof parsed === "string"
            ? parsed
            : parsed?.title ?? "Unknown error";
        const code = parsed?.code ?? response.status;

        throw new HTTPException(message, code);
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
