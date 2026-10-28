---
name: consume-json-api
description: Call a JSON:API backend with @schorts/shared-kernel — FetchHTTPProvider with auth, JSONAPIConnector with Criteria for filters, sorting, and pagination, EntityJSONAPIMapper to turn resources into entities, JSONAPIErrors handling, and tests with InMemoryHTTPProvider. Use when the app reads or writes resources from a JSON:API service.
---

<!-- check-uses: ../implement-dao/SKILL.md -->

# Consume a JSON:API backend

This skill builds a typed client for a `/products` JSON:API endpoint, returning the `Product` entity from [implement-dao](../implement-dao/SKILL.md).

## 1. The client

- Depend on `JSONAPIConnector`; the HTTP provider is chosen at wiring time.
- The connector's type argument is the resource's attributes (the model).
- Pass filters, sorting, and pagination as a `Criteria`; the connector writes `filter[...]`, `sort`, and `page[...]` params.
- `EntityJSONAPIMapper` converts resources to entities (through `Product.fromPrimitives`) and entities to resources.
- `meta` and `included` are untyped on the wire; narrow what you read.
- Turn `JSONAPIErrors` into errors your application understands.

```ts
// file: catalog/products-api.ts
import { Criteria } from "@schorts/shared-kernel/criteria";
import { EntityJSONAPIMapper, JSONAPIConnector, JSONAPIErrors } from "@schorts/shared-kernel/json-api";
import { Product } from "./product.js";
import type { ProductModel } from "./product.js";

export class ProductRejected extends Error {
  override name = "ProductRejected";

  constructor(readonly fields: Record<string, string>) {
    super(`Product rejected: ${Object.keys(fields).join(", ")}`);
  }
}

export class ProductsApi {
  private readonly mapper = new EntityJSONAPIMapper<ProductModel, Product>("products", Product);

  constructor(private readonly connector: JSONAPIConnector) {}

  async search(criteria: Criteria): Promise<{ products: Product[]; total: number | null; next: string | null }> {
    const document = await this.connector.findMany<ProductModel>("/products", { criteria });
    const total = document.meta?.["total"];

    return {
      products: this.mapper.toEntities(document),
      total: typeof total === "number" ? total : null,
      next: document.links?.next ?? null,
    };
  }

  async create(product: Product): Promise<Product> {
    const { data } = this.mapper.mapEntity(product);
    try {
      const document = await this.connector.create<ProductModel>("/products", {
        type: data.type,
        attributes: data.attributes,
      });
      return this.mapper.toEntity(document);
    } catch (error) {
      if (error instanceof JSONAPIErrors) {
        const fields: Record<string, string> = {};
        for (const item of error.errors) {
          const pointer = item.source && "pointer" in item.source ? item.source.pointer : "/data";
          fields[pointer.replace("/data/attributes/", "")] = item.detail || item.title;
        }
        throw new ProductRejected(fields);
      }
      throw error;
    }
  }
}
```

Build queries the same way you would for a DAO:

```ts
// file: catalog/search-examples.ts
import { Criteria } from "@schorts/shared-kernel/criteria";

export const cheapLamps = Criteria.none()
  .where("name", "LIKE", "lamp")
  .where("price", "LESS_THAN", 50)
  .orderBy("price", "ASC")
  .limitResults(20)
  .offsetResults(0);
```

## 2. Wire it

Configure `FetchHTTPProvider` once. `getAuthorization` runs before every request, so it can return a freshly refreshed token. Relative paths such as `/products` resolve against `baseUrl`.

```ts
// file: catalog/wire-products-api.ts
import { FetchHTTPProvider } from "@schorts/shared-kernel/http";
import { JSONAPIConnector } from "@schorts/shared-kernel/json-api";
import { ProductsApi } from "./products-api.js";

export function createProductsApi(options: { baseUrl: string; getToken: () => Promise<string> }) {
  const http = new FetchHTTPProvider({
    baseUrl: options.baseUrl,
    headers: { Accept: "application/vnd.api+json" },
    getAuthorization: async () => `Bearer ${await options.getToken()}`,
  });
  http.useInterceptor({
    request: init => {
      const headers = new Headers(init.headers);
      headers.set("X-Client", "web");
      return { ...init, headers };
    },
  });

  return new ProductsApi(new JSONAPIConnector(http));
}
```

## 3. Test it

Stub routes on `InMemoryHTTPProvider`, then assert on what was sent and what came back. Throw `HTTPException` from a route to simulate an error response.

```ts
// file: catalog/products-api.test.ts
import { Criteria } from "@schorts/shared-kernel/criteria";
import { HTTPException, InMemoryHTTPProvider } from "@schorts/shared-kernel/http";
import { JSONAPIConnector } from "@schorts/shared-kernel/json-api";
import { Product, ProductId } from "./product.js";
import { ProductRejected, ProductsApi } from "./products-api.js";

const lampId = "3c9b7f1e-5a2d-4e8f-9b0c-1d2e3f4a5b6c";

function setup() {
  const http = new InMemoryHTTPProvider({ baseUrl: "https://api.example.com" });
  return { http, api: new ProductsApi(new JSONAPIConnector(http)) };
}

describe("ProductsApi", () => {
  it("sends criteria as JSON:API params and maps resources to entities", async () => {
    const { http, api } = setup();
    http.on("GET", url => url.pathname === "/products", {
      data: [{ id: lampId, type: "products", attributes: { name: "Desk lamp", price: 35, tags: ["sale"] } }],
      meta: { total: 1 },
      links: { next: "https://api.example.com/products?page[offset]=20" },
    });

    const result = await api.search(Criteria.none().where("price", "LESS_THAN", 50).orderBy("price", "ASC").limitResults(20));

    const sent = http.getRequests()[0]?.url;
    expect(sent?.searchParams.get("filter[price][lt]")).toBe("50");
    expect(sent?.searchParams.get("sort")).toBe("price");
    expect(sent?.searchParams.get("page[limit]")).toBe("20");
    expect(result.products[0]).toBeInstanceOf(Product);
    expect(result.products[0]?.toPrimitives()).toEqual({ id: lampId, name: "Desk lamp", price: 35, tags: ["sale"] });
    expect(result.total).toBe(1);
    expect(result.next).toContain("page[offset]=20");
  });

  it("turns JSON:API errors into ProductRejected", async () => {
    const { http, api } = setup();
    http.on("POST", url => url.pathname === "/products", () => {
      throw new HTTPException(422, {
        errors: [{ status: "422", code: "too_low", title: "Invalid", detail: "must be positive", source: { pointer: "/data/attributes/price" } }],
      });
    });

    const error = await api.create(new Product(new ProductId(lampId), "Lamp", -1)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProductRejected);
    expect((error as ProductRejected).fields).toEqual({ price: "must be positive" });
    expect(http.getRequests()[0]?.options?.body).toEqual({
      data: { type: "products", attributes: { name: "Lamp", price: -1, tags: [] } },
    });
  });
});
```

## Checklist

- [ ] Client depends on `JSONAPIConnector`; `FetchHTTPProvider` configured once with `baseUrl` and `getAuthorization`.
- [ ] Queries passed as `Criteria`, not hand-built query strings.
- [ ] Resources mapped to entities with `EntityJSONAPIMapper`; `meta`/`included` narrowed before use.
- [ ] `JSONAPIErrors` translated into application errors.
- [ ] Tests stub routes on `InMemoryHTTPProvider` and assert on the requests sent.
