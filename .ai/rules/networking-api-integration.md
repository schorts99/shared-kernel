# 🌐 Rule: Networking & API Integration Standards

This rule specifies standards for HTTP providers, JSON:API integrations, real-time pub-sub channels, and mail delivery in `@schorts/shared-kernel`.

---

## 1. HTTP Transport (`src/http`)

Framework and environment agnostic HTTP client abstractions.

### Standards:
1. **HTTPProvider Interface**:
   - Defines methods: `get<T>(url, options?)`, `post<T>(url, body, options?)`, `put<T>(url, body, options?)`, `patch<T>(url, body, options?)`, `delete<T>(url, options?)`.
2. **FetchHTTPProvider**:
   - Concrete implementation utilizing native `fetch` API.
   - Converts non-2xx responses into structured HTTP exceptions (`HTTPException`, `HTTPNotFoundException`, `HTTPUnauthorizedException`).
3. **HTTPInterceptor**:
   - Middleware interface for mutating request headers (e.g. injecting Bearer tokens, correlation IDs) or processing raw responses.

---

## 2. JSON:API Integration (`src/json-api`)

Specification-compliant connector for JSON:API formatted endpoints.

### Standards:
1. **JSONAPIConnector**:
   - High-level API for querying and mutating JSON:API endpoints using `Criteria`.
   - Methods: `findMany<T>(url, criteria?)`, `findOne<T>(url, id)`, `create<T>(url, data)`, `update<T>(url, id, data)`, `delete(url, id)`.
2. **URLCriteriaParser & Builder**:
   - `URLCriteriaParser`: Converts incoming JSON:API query strings (`filter[status]=active&sort=-created_at&page[offset]=0&page[limit]=10`) into a type-safe `Criteria` object.
   - `URLCriteriaBuilder`: Serializes a `Criteria` object back into JSON:API query parameters appended to a `URL`.
3. **EntityJSONAPIMapper**:
   - Maps domain `Entity` objects to JSON:API document structures (`{ data: { id, type, attributes, relationships } }`) and vice-versa.

---

## 3. Real-Time Pub-Sub & Mail (`src/pub-sub`, `src/mail`)

Communication channels.

### Standards:
1. **Pub-Sub**:
   - `Publisher`: Interface for pushing events to real-time transports (Pusher, WebSockets, Socket.IO).
   - `Subscription`: Interface for client-side channel subscriptions and event listener unbinding.
2. **Mail**:
   - `Mail`: Value payload representing sender, recipients (`to`, `cc`, `bcc`), subject, text body, and HTML body.
   - `Mailer`: Interface exposing `send(mail: Mail): Promise<void>`.
