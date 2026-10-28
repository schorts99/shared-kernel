import {
  Criteria,
  Entity,
  InMemoryDAO,
  InMemoryUnitOfWork,
  UUIDValue,
} from "../../src";
import {
  TestUUIDValue,
} from "../support/fixtures";

describe("InMemoryDAO", () => {
  it("supports all operators, soft delete and restore, entity isolation, and UnitOfWork transactions", async () => {
    interface StoreModel {
      id: string;
      name: string;
      score: number;
      tags: string[];
      location: { latitude: number; longitude: number };
      deletedAt?: string | null;
    }

    class StoreEntity extends Entity<UUIDValue, StoreModel> {
      constructor(
        id: UUIDValue,
        public name: string,
        public score: number,
        public tags: string[],
        public location: { latitude: number; longitude: number },
        public deletedAt: string | null = null,
      ) {
        super(id);
      }

      toPrimitives(): StoreModel {
        return {
          id: this.id.value,
          name: this.name,
          score: this.score,
          tags: [...this.tags],
          location: { ...this.location },
          deletedAt: this.deletedAt,
        };
      }
    }

    const dao = new InMemoryDAO<StoreModel, StoreEntity>("SOFT");

    const nycId = new TestUUIDValue("123e4567-e89b-12d3-a456-426614174001");
    const laId = new TestUUIDValue("123e4567-e89b-12d3-a456-426614174002");

    const nycStore = new StoreEntity(
      nycId,
      "NYC Flagship",
      95,
      ["flagship", "east-coast"],
      { latitude: 40.7128, longitude: -74.006 },
    );
    const laStore = new StoreEntity(
      laId,
      "LA Hub",
      80,
      ["west-coast", "outlet"],
      { latitude: 34.0522, longitude: -118.2437 },
    );

    // 1. Transactional UnitOfWork rollback discards uncommitted writes
    const uowRollback = new InMemoryUnitOfWork();
    await uowRollback.begin();
    await dao.create(nycStore, uowRollback);
    expect(await dao.count(uowRollback)).toBe(1);
    expect(await dao.count()).toBe(0);
    await uowRollback.rollback();
    expect(await dao.count()).toBe(0);

    // 2. Transactional UnitOfWork commit persists writes
    const uowCommit = new InMemoryUnitOfWork();
    await uowCommit.begin();
    await dao.saveMany([nycStore, laStore], uowCommit);
    expect(await dao.count()).toBe(0);
    await uowCommit.commit();
    expect(await dao.count()).toBe(2);

    // 3. Entity isolation on read
    const fetchedNyc = await dao.findByID(nycId.value);
    expect(fetchedNyc).not.toBeNull();
    fetchedNyc!.name = "Tampered";
    fetchedNyc!.tags.push("tampered");
    const fetchedNycAgain = await dao.findByID(nycId.value);
    expect(fetchedNycAgain?.name).toBe("NYC Flagship");
    expect(fetchedNycAgain?.tags).toEqual(["flagship", "east-coast"]);

    // 4. Criteria operators: BETWEEN, ARRAY_CONTAINS, ARRAY_CONTAINS_ANY, GEO_RADIUS
    const betweenResults = await dao.search(Criteria.none().where("score", "BETWEEN", [90, 100]));
    expect(betweenResults.map(e => e.name)).toEqual(["NYC Flagship"]);

    const containsResults = await dao.search(
      Criteria.none().where("tags", "ARRAY_CONTAINS", "flagship"),
    );
    expect(containsResults.map(e => e.name)).toEqual(["NYC Flagship"]);

    const containsAnyResults = await dao.search(
      Criteria.none().where("tags", "ARRAY_CONTAINS_ANY", ["outlet", "non-existent"]),
    );
    expect(containsAnyResults.map(e => e.name)).toEqual(["LA Hub"]);

    const geoResults = await dao.search(
      Criteria.none().where("location", "GEO_RADIUS", {
        lat: 40.758,
        lng: -73.9855,
        radius: 15_000, // 15 km around Times Square
      }),
    );
    expect(geoResults.map(e => e.name)).toEqual(["NYC Flagship"]);

    // 5. Soft delete & restore
    await dao.deleteByID(laId.value);
    expect(await dao.count()).toBe(1);
    expect(await dao.findByID(laId.value)).toBeNull();

    await dao.restore(laStore);
    expect(await dao.count()).toBe(2);
    expect((await dao.findByID(laId.value))?.name).toBe("LA Hub");
  });

  it("compares Date filters with ISO strings, supports LIKE wildcards, and orders nulls last", async () => {
    class DaoItemId extends UUIDValue {
      readonly attributeName = "id";
    }
    interface DaoItemModel {
      id: string;
      name: string;
      occurredAt: string;
      rank: number | null;
      createdAt: string;
      updatedAt: string;
    }
    class DaoItemEntity extends Entity<DaoItemId, DaoItemModel> {
      readonly createdAt = "2026-01-01T00:00:00.000Z";
      readonly updatedAt = "2026-01-01T00:00:00.000Z";

      constructor(
        id: DaoItemId,
        public name: string,
        public occurredAt: string,
        public rank: number | null,
      ) {
        super(id);
      }
      protected override createId(rawId: string | DaoItemId): DaoItemId {
        return rawId instanceof DaoItemId ? rawId : new DaoItemId(rawId);
      }
      toPrimitives(): DaoItemModel {
        return {
          id: this.id.value,
          name: this.name,
          occurredAt: this.occurredAt,
          rank: this.rank,
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
        };
      }
    }

    const dao = new InMemoryDAO<DaoItemModel, DaoItemEntity>();
    const id1 = "123e4567-e89b-12d3-a456-426614174001";
    const id2 = "123e4567-e89b-12d3-a456-426614174002";
    const id3 = "123e4567-e89b-12d3-a456-426614174003";

    await dao.create(new DaoItemEntity(new DaoItemId(id1), "alpha-service", "2026-05-01T00:00:00.000Z", null));
    await dao.create(new DaoItemEntity(new DaoItemId(id2), "beta-alpha", "2026-05-10T00:00:00.000Z", 20));
    await dao.create(new DaoItemEntity(new DaoItemId(id3), "gamma-core", "2026-05-20T00:00:00.000Z", 5));

    // Date filter against ISO-8601 string in entity primitives
    const byAfterDate = await dao.search(
      Criteria.none().where("occurredAt", "GREATER_THAN", new Date("2026-05-05T00:00:00.000Z")),
    );
    expect(byAfterDate.map((e) => e.id.value)).toEqual([id2, id3]);

    const byBetweenDates = await dao.search(
      Criteria.none().where("occurredAt", "BETWEEN", [
        new Date("2026-05-01T00:00:00.000Z"),
        new Date("2026-05-12T00:00:00.000Z"),
      ]),
    );
    expect(byBetweenDates.map((e) => e.id.value)).toEqual([id1, id2]);

    // Anchored SQL LIKE wildcards vs plain substring LIKE
    const prefixAlpha = await dao.search(Criteria.none().where("name", "LIKE", "alpha%"));
    expect(prefixAlpha.map((e) => e.id.value)).toEqual([id1]);

    const substringAlpha = await dao.search(Criteria.none().where("name", "LIKE", "alpha"));
    expect(substringAlpha.map((e) => e.id.value)).toEqual([id1, id2]);

    // Null-safe ordering (nulls placed consistently last)
    const orderedByRank = await dao.search(Criteria.none().orderBy("rank", "ASC"));
    expect(orderedByRank.map((e) => e.id.value)).toEqual([id3, id2, id1]);
  });
});
