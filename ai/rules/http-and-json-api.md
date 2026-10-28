# HTTP and JSON:API rules

Applies to `http`, `json-api`, and `utils` URL helpers.

## HTTP providers

- Depend on the `HTTPProvider` interface; inject `FetchHTTPProvider` in the app and `InMemoryHTTPProvider` in tests.
- Configure `FetchHTTPProvider` once: `new FetchHTTPProvider({ baseUrl, headers, credentials, getAuthorization })`. `getAuthorization` may be async and is called per request, so token refresh works.
- Pass the expected response type: `await http.get<Order>("/orders/1")`. It is not validated at runtime; validate untrusted responses yourself.
- Request options: `{ query, headers, body, signal, timeoutMs, deduplicate }`. Bodies are JSON-encoded unless they are already a native body (`FormData`, `Blob`, string, and similar). Query values can be arrays (repeated params).
- Non-2xx responses throw `HTTPException` with `statusCode` and `body` (typed `unknown`).
- Cross-cutting concerns (tracing headers, error mapping) go in interceptors: `provider.useInterceptor({ request, response, error })`.

## JSON:API

- Use `JSONAPIConnector(httpProvider)` for JSON:API backends: `findOne`, `findMany`, `create`, `update`, `delete`.
- Pass filtering, sorting, and pagination as a `Criteria` and relationships as `include`: `connector.findMany<OrderAttributes>(url, { criteria, include: ["customer"] })`. The connector builds `filter[...]`, `sort`, `page[...]`, and `include` params.
- The type argument is the resource's attributes. Responses are `JSONAPIList<A>` (`data[]`, `included`, `meta`, `links`) and `JSONAPISingle<A>`; `included` resources and `meta` are typed `unknown`-valued records.
- A JSON:API error response throws `JSONAPIErrors` with the server's `errors` array; other failures throw `HTTPException` or the original error.
- Relative URLs stay relative, so the provider's `baseUrl` applies.
- Convert between entities and JSON:API documents with `EntityJSONAPIMapper(type, entityClassOrFactory)`.
- On the server side, parse incoming query strings with `new URLCriteriaParser(url, allowedFields).parse()` (always pass the allow-list) and build `links` with `new PaginationLinksGenerator(url).generate(offset, limit, total)`.

## URL helpers

- Build URLs with `URLWithParamsBuilder` instead of string concatenation; it never mutates the input URL, repeats array values, and drops `undefined`.

See [skills/consume-json-api](../skills/consume-json-api/SKILL.md).
