import { DAO } from "../../src/dao/dao";
import { Model } from "../../src/models";
import { Entity } from "../../src/entities";
import { ValueObject } from "../../src/value-objects";
import { Criteria } from "../../src/criteria";
import { UnitOfWork } from "../../src/unit-of-work";

interface MockModel extends Model {
  id: string;
  name: string;
}

class MockID implements ValueObject {
  constructor(readonly value: string) { }
  readonly valueType = "string";
  readonly attributeName = "id";
  isValid = true;

  equals(vo: any): boolean {
    return vo && typeof vo === 'object' && vo.value === this.value;
  }
}


class MockEntity extends Entity<MockID, MockModel> {
  constructor(id: MockID, readonly name: string) {
    super(id);
  }
  toPrimitives(): MockModel {
    return { id: this.id.value, name: this.name };
  }
}

class TestDAO extends DAO<MockModel, MockEntity> {
  async getAll(): Promise<MockEntity[]> { return []; }
  async findByID(id: string): Promise<MockEntity | null> { return null; }
  async findOneBy(criteria: Criteria): Promise<MockEntity | null> { return null; }
  async countBy(criteria: Criteria): Promise<number> { return 0; }
  async exists(criteria: Criteria): Promise<boolean> { return false; }
  async create(entity: MockEntity, uow?: UnitOfWork): Promise<MockEntity> { return entity; }
  async update(entity: MockEntity, uow?: UnitOfWork): Promise<MockEntity> { return entity; }
  async save(entity: MockEntity, uow?: UnitOfWork): Promise<MockEntity> { return entity; }
  async delete(entity: MockEntity, uow?: UnitOfWork): Promise<MockEntity> { return entity; }
  async deleteByID(id: string, uow?: UnitOfWork): Promise<void> { }
  async saveMany(entities: MockEntity[], uow?: UnitOfWork): Promise<MockEntity[]> { return entities; }

  public getDeleteMode() {
    return this.deleteMode;
  }
}

describe("DAO", () => {
  it("should initialize with default deleteMode 'HARD'", () => {
    const dao = new TestDAO();

    expect(dao.getDeleteMode()).toBe("HARD");
  });

  it("should initialize with custom deleteMode", () => {
    const dao = new TestDAO("SOFT");

    expect(dao.getDeleteMode()).toBe("SOFT");
  });

  it("should be able to implement all abstract methods", async () => {
    const dao = new TestDAO();
    const mockId = new MockID("123");
    const mockEntity = new MockEntity(mockId, "Test");
    const criteria = Criteria.none();

    expect(await dao.getAll()).toEqual([]);
    expect(await dao.findByID("123")).toBeNull();
    expect(await dao.findOneBy(criteria)).toBeNull();
    expect(await dao.countBy(criteria)).toBe(0);
    expect(await dao.exists(criteria)).toBe(false);
    expect(await dao.create(mockEntity)).toBe(mockEntity);
    expect(await dao.update(mockEntity)).toBe(mockEntity);
    expect(await dao.save(mockEntity)).toBe(mockEntity);
    expect(await dao.delete(mockEntity)).toBe(mockEntity);

    await expect(dao.deleteByID("123")).resolves.toBeUndefined();

    expect(await dao.saveMany([mockEntity])).toEqual([mockEntity]);
  });
});
