---
name: implement-dao
description: Implement a DAO for a real database with @schorts/shared-kernel — translate Criteria filters to SQL by switching on the typed operator, reuse readBetweenBounds/readGeoRadius, allow-list columns, honor the UnitOfWork for transactions, support soft delete, and test the translation. Use when persisting entities in Postgres, MySQL, SQLite, or another store.
---

# Implement a DAO

A DAO stores `Entity` subclasses and answers `Criteria` queries. This skill implements one for Postgres over a minimal SQL client, so you can adapt it to `pg`, Kysely, Drizzle, or another driver. `InMemoryDAO` remains the reference behavior and the implementation to use in tests.

DAOs store entities only. For an `AggregateRoot`, write a repository instead (see [create-aggregate](../create-aggregate/SKILL.md)).

## 1. The entity

```ts
// file: catalog/product.ts
import { Entity } from "@schorts/shared-kernel/entities";
import { UUIDValue } from "@schorts/shared-kernel/value-objects";

export class ProductId extends UUIDValue {
  readonly attributeName = "productId";
}

export type ProductModel = {
  id: string;
  name: string;
  price: number;
  tags: string[];
};

export class Product extends Entity<ProductId, ProductModel> {
  constructor(id: ProductId, public name = "", public price = 0, public tags: string[] = []) {
    super(id);
  }

  toPrimitives(): ProductModel {
    return { id: this.id.value, name: this.name, price: this.price, tags: [...this.tags] };
  }

  protected override createId(rawId: unknown): ProductId {
    return new ProductId(String(rawId));
  }

  protected override restoreFromPrimitives(data: ProductModel): void {
    this.name = data.name;
    this.price = data.price;
    this.tags = [...data.tags];
  }
}
```

## 2. Translate criteria to SQL

- Switch on `filter.operator`; TypeScript then knows the type of `filter.value` in each branch.
- Map model fields to columns through an allow-list. Never interpolate a field name the caller chose.
- Send values as parameters, never in the SQL text.
- Match `InMemoryDAO` semantics so tests and production agree: `LIKE` without wildcards means "contains", matching ignores case, `BETWEEN` is inclusive, and nulls sort last.
- Use `readBetweenBounds` and `readGeoRadius` to accept every shape callers may pass.

```ts
// file: catalog/criteria-to-sql.ts
import { readBetweenBounds, readGeoRadius } from "@schorts/shared-kernel/criteria";
import type { Criteria, Filter } from "@schorts/shared-kernel/criteria";

export type SqlFragment = { text: string; params: unknown[] };

export function criteriaToSql(criteria: Criteria, columns: Record<string, string>): SqlFragment {
  const params: unknown[] = [];
  const param = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const column = (field: string) => {
    const name = columns[field];
    if (!name) throw new Error(`Unknown field "${field}"`);
    return name;
  };

  const where = criteria.filters.map(filter => filterToSql(filter, column(filter.field), param));
  const orders = criteria.orders
    .filter(order => order.direction !== "NONE")
    .map(order => `${column(order.field)} ${order.direction} NULLS LAST`);

  let text = where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "";
  if (orders.length > 0) text += ` ORDER BY ${orders.join(", ")}`;
  if (criteria.limit !== undefined) text += ` LIMIT ${param(criteria.limit)}`;
  if (criteria.offset !== undefined) text += ` OFFSET ${param(criteria.offset)}`;
  return { text, params };
}

function filterToSql(filter: Filter, column: string, param: (value: unknown) => string): string {
  switch (filter.operator) {
    case "EQUAL":
      return filter.value === null ? `${column} IS NULL` : `${column} = ${param(filter.value)}`;
    case "NOT_EQUAL":
      return filter.value === null ? `${column} IS NOT NULL` : `${column} IS DISTINCT FROM ${param(filter.value)}`;
    case "GREATER_THAN":
      return `${column} > ${param(filter.value)}`;
    case "GREATER_THAN_OR_EQUAL":
      return `${column} >= ${param(filter.value)}`;
    case "LESS_THAN":
      return `${column} < ${param(filter.value)}`;
    case "LESS_THAN_OR_EQUAL":
      return `${column} <= ${param(filter.value)}`;
    case "IN":
      return filter.value.length === 0 ? "FALSE" : `${column} = ANY(${param([...filter.value])})`;
    case "NOT_IN":
      return filter.value.length === 0 ? "TRUE" : `NOT (${column} = ANY(${param([...filter.value])}))`;
    case "LIKE": {
      const hasWildcard = filter.value.includes("%") || filter.value.includes("_");
      return `${column} ILIKE ${param(hasWildcard ? filter.value : `%${filter.value}%`)}`;
    }
    case "BETWEEN": {
      const bounds = readBetweenBounds(filter.value);
      if (!bounds) throw new Error(`BETWEEN on "${filter.field}" needs two bounds`);
      return `${column} BETWEEN ${param(bounds[0])} AND ${param(bounds[1])}`;
    }
    case "ARRAY_CONTAINS":
      return `${param(filter.value)} = ANY(${column})`;
    case "ARRAY_CONTAINS_ANY":
      return `${column} && ${param([...filter.value])}`;
    case "GEO_RADIUS": {
      const geo = readGeoRadius(filter.value);
      if (!geo) throw new Error(`GEO_RADIUS on "${filter.field}" needs a center and radius`);
      return `ST_DWithin(${column}::geography, ST_MakePoint(${param(geo.lng)}, ${param(geo.lat)})::geography, ${param(geo.radiusInM)})`;
    }
    default: {
      const unsupported: never = filter;
      throw new Error(`Unsupported filter ${JSON.stringify(unsupported)}`);
    }
  }
}
```

## 3. Transactions

Represent your driver's transaction as a `UnitOfWork`. The DAO runs on its client when one is passed, so all calls in a unit of work share a transaction.

```ts
// file: catalog/sql-unit-of-work.ts
import type { UnitOfWork } from "@schorts/shared-kernel/unit-of-work";

export interface SqlClient {
  query<Row = Record<string, unknown>>(text: string, params?: unknown[]): Promise<Row[]>;
}

export class SqlUnitOfWork implements UnitOfWork {
  private active = false;

  constructor(readonly client: SqlClient) {}

  async begin(): Promise<void> {
    await this.client.query("BEGIN");
    this.active = true;
  }

  async commit(): Promise<void> {
    await this.client.query("COMMIT");
    this.active = false;
  }

  async rollback(): Promise<void> {
    await this.client.query("ROLLBACK");
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }
}
```

## 4. The DAO

Implement every abstract method. Rows become entities through `Product.fromPrimitives`; entities become rows through `toPrimitives()`.

```ts
// file: catalog/postgres-product-dao.ts
import { Criteria } from "@schorts/shared-kernel/criteria";
import { DAO } from "@schorts/shared-kernel/dao";
import type { DeleteMode } from "@schorts/shared-kernel/dao";
import type { UnitOfWork } from "@schorts/shared-kernel/unit-of-work";
import { criteriaToSql } from "./criteria-to-sql.js";
import { Product } from "./product.js";
import type { ProductModel } from "./product.js";
import { SqlUnitOfWork } from "./sql-unit-of-work.js";
import type { SqlClient } from "./sql-unit-of-work.js";

const COLUMNS = { id: "id", name: "name", price: "price", tags: "tags" };
const SELECT = "SELECT id, name, price, tags FROM products";

export class PostgresProductDAO extends DAO<ProductModel, Product> {
  constructor(private readonly pool: SqlClient, deleteMode: DeleteMode = "SOFT") {
    super(deleteMode);
  }

  private client(uow?: UnitOfWork): SqlClient {
    return uow instanceof SqlUnitOfWork ? uow.client : this.pool;
  }

  private visible(criteria: Criteria): Criteria {
    return this.deleteMode === "SOFT" ? criteria.where("deletedAt", "EQUAL", null) : criteria;
  }

  private async select(criteria: Criteria, uow?: UnitOfWork): Promise<Product[]> {
    const { text, params } = criteriaToSql(this.visible(criteria), { ...COLUMNS, deletedAt: "deleted_at" });
    const rows = await this.client(uow).query<ProductModel>(`${SELECT}${text}`, params);
    return rows.map(row => Product.fromPrimitives(row));
  }

  async getAll(uow?: UnitOfWork): Promise<Product[]> {
    return this.select(Criteria.none(), uow);
  }

  async findByID(id: string, uow?: UnitOfWork): Promise<Product | null> {
    return this.findOneBy(Criteria.none().where("id", "EQUAL", id), uow);
  }

  async findOneBy(criteria: Criteria, uow?: UnitOfWork): Promise<Product | null> {
    const [first] = await this.select(criteria.limitResults(1), uow);
    return first ?? null;
  }

  async search(criteria: Criteria, uow?: UnitOfWork): Promise<Product[]> {
    return this.select(criteria, uow);
  }

  async count(uow?: UnitOfWork): Promise<number> {
    return this.countBy(Criteria.none(), uow);
  }

  async countBy(criteria: Criteria, uow?: UnitOfWork): Promise<number> {
    const filtersOnly = new Criteria(this.visible(criteria).filters);
    const { text, params } = criteriaToSql(filtersOnly, { ...COLUMNS, deletedAt: "deleted_at" });
    const [row] = await this.client(uow).query<{ count: string }>(`SELECT count(*) AS count FROM products${text}`, params);
    return Number(row?.count ?? 0);
  }

  async exists(criteria: Criteria, uow?: UnitOfWork): Promise<boolean> {
    return (await this.countBy(criteria, uow)) > 0;
  }

  async create(entity: Product, uow?: UnitOfWork): Promise<Product> {
    const row = entity.toPrimitives();
    await this.client(uow).query(
      "INSERT INTO products (id, name, price, tags) VALUES ($1, $2, $3, $4)",
      [row.id, row.name, row.price, row.tags],
    );
    return entity;
  }

  async update(entity: Product, uow?: UnitOfWork): Promise<Product> {
    const row = entity.toPrimitives();
    const updated = await this.client(uow).query(
      "UPDATE products SET name = $2, price = $3, tags = $4 WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [row.id, row.name, row.price, row.tags],
    );
    if (updated.length === 0) throw new Error(`Product ${row.id} not found`);
    return entity;
  }

  async save(entity: Product, uow?: UnitOfWork): Promise<Product> {
    const row = entity.toPrimitives();
    await this.client(uow).query(
      `INSERT INTO products (id, name, price, tags) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = $2, price = $3, tags = $4, deleted_at = NULL`,
      [row.id, row.name, row.price, row.tags],
    );
    return entity;
  }

  async saveMany(entities: Product[], uow?: UnitOfWork): Promise<Product[]> {
    for (const entity of entities) await this.save(entity, uow);
    return entities;
  }

  async delete(entity: Product, uow?: UnitOfWork): Promise<Product> {
    await this.deleteByID(entity.id.value, uow);
    return entity;
  }

  async deleteByID(id: string, uow?: UnitOfWork): Promise<void> {
    const sql = this.deleteMode === "SOFT"
      ? "UPDATE products SET deleted_at = now() WHERE id = $1"
      : "DELETE FROM products WHERE id = $1";
    await this.client(uow).query(sql, [id]);
  }

  async restore(entity: Product, uow?: UnitOfWork): Promise<Product> {
    await this.client(uow).query("UPDATE products SET deleted_at = NULL WHERE id = $1", [entity.id.value]);
    return entity;
  }
}
```

## 5. Test it

Unit-test the translation; run the DAO itself against a real database in integration tests. Application tests use `InMemoryDAO`.

```ts
// file: catalog/criteria-to-sql.test.ts
import { Criteria } from "@schorts/shared-kernel/criteria";
import { criteriaToSql } from "./criteria-to-sql.js";

const columns = { name: "name", price: "price", tags: "tags", location: "location" };

describe("criteriaToSql", () => {
  it("parameterizes values and matches InMemoryDAO semantics", () => {
    const criteria = Criteria.none()
      .where("name", "LIKE", "lamp")
      .where("price", "BETWEEN", { min: 10, max: 50 })
      .where("tags", "ARRAY_CONTAINS_ANY", ["sale", "new"])
      .orderBy("price", "ASC")
      .limitResults(20);

    expect(criteriaToSql(criteria, columns)).toEqual({
      text: " WHERE name ILIKE $1 AND price BETWEEN $2 AND $3 AND tags && $4 ORDER BY price ASC NULLS LAST LIMIT $5",
      params: ["%lamp%", 10, 50, ["sale", "new"], 20],
    });
  });

  it("reads every GEO_RADIUS shape", () => {
    const { params } = criteriaToSql(
      Criteria.none().where("location", "GEO_RADIUS", { center: { lat: 40.7, lng: -74 }, radiusInKm: 2 }),
      columns,
    );
    expect(params).toEqual([-74, 40.7, 2000]);
  });

  it("rejects fields outside the allow-list", () => {
    expect(() => criteriaToSql(Criteria.none().where("password", "EQUAL", "x"), columns)).toThrow('Unknown field "password"');
  });
});
```

## Checklist

- [ ] Every abstract `DAO` method implemented; entities in and out.
- [ ] Filters translated with an exhaustive `switch (filter.operator)` and an allow-list of columns.
- [ ] Values passed as parameters.
- [ ] `readBetweenBounds`/`readGeoRadius` used, semantics match `InMemoryDAO`.
- [ ] `UnitOfWork` honored by every method; soft delete hides rows from reads.
- [ ] Translation unit-tested; DAO covered by integration tests against the real database.
