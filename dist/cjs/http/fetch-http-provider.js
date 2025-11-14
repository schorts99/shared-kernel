"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchHTTPProvider = void 0;
const exceptions_1 = require("./exceptions");
class FetchHTTPProvider {
    ongoingRequests = new Map();
    init;
    getAuthorization;
    interceptors = [];
    constructor(getAuthorization, init) {
        this.getAuthorization = getAuthorization;
        this.init = init;
    }
    useInterceptor(interceptor) {
        this.interceptors.push(interceptor);
    }
    get(url, body) {
        return this.request("GET", url, body);
    }
    post(url, body) {
        return this.request("POST", url, body);
    }
    put(url, body) {
        return this.request("PUT", url, body);
    }
    patch(url, body) {
        return this.request("PATCH", url, body);
    }
    delete(url, body) {
        return this.request("DELETE", url, body);
    }
    async request(method, url, body) {
        const key = this.generateRequestKey(method, url, body);
        if (this.ongoingRequests.has(key)) {
            return this.ongoingRequests.get(key);
        }
        const baseHeaders = this.init?.headers ?? {};
        const authHeader = this.getAuthorization ? { Authorization: this.getAuthorization() } : {};
        const contentTypeHeader = body !== undefined ? { "Content-Type": "application/json" } : {};
        const headers = {
            ...baseHeaders,
            ...contentTypeHeader,
            ...authHeader,
        };
        let init = {
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
                throw new exceptions_1.HTTPException(0, undefined);
            }
            if (response.status === 204) {
                return undefined;
            }
            const contentType = response.headers.get("Content-Type") ?? "";
            let parsed;
            try {
                if (contentType.includes("application/json")) {
                    parsed = await response.json();
                }
                else if (contentType.includes("text/")) {
                    parsed = await response.text();
                }
                else {
                    parsed = await response.blob();
                }
            }
            catch {
                parsed = undefined;
            }
            if (!response.ok) {
                throw new exceptions_1.HTTPException(response.status, parsed);
            }
            return parsed;
        })().finally(() => {
            this.ongoingRequests.delete(key);
        });
        this.ongoingRequests.set(key, request);
        return request;
    }
    generateRequestKey(method, url, body) {
        const base = `${method}:${url.href}`;
        const bodyHash = body !== undefined ? this.hashString(JSON.stringify(body)) : "";
        return `${base}:${bodyHash}`;
    }
    hashString(input) {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const chr = input.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0;
        }
        return hash.toString();
    }
}
exports.FetchHTTPProvider = FetchHTTPProvider;
//# sourceMappingURL=fetch-http-provider.js.map