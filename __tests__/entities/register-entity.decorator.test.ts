import { RegisterEntity, EntityRegistry, Entity, EntityNotRegistered } from "../../src/entities";
import { UUIDValue } from "../../src/value-objects";

type MockModel = {
  id: string;
};

class ID extends UUIDValue {
  attributeName = "id";
}

class MockEntity extends Entity<ID, MockModel> {
  constructor(id: ID) {
    super(id);
  }

  toPrimitives(): MockModel {
    return {
      id: this.id.value,
    };
  }

  static fromPrimitives<MockModel>(model: MockModel): MockEntity {
    return new MockEntity(new ID(model["id"]));
  }
}

RegisterEntity("mock")(MockEntity);

describe("RegisterEntity", () => {
  beforeEach(() => {
    (EntityRegistry as any).registry.clear();
    RegisterEntity("mock")(MockEntity);
  });

  it("registers the entity constructor under the given type", () => {
    const resolved = EntityRegistry.resolve<MockModel>("mock");
    expect(resolved).toBe(MockEntity);
  });

  it("creates an entity instance from registered type", () => {
    const model = { id: 'abc-123' };
    const entity = EntityRegistry.create("mock", model);

    expect(entity).toBeInstanceOf(MockEntity);
    expect(entity.id.value).toBe("abc-123");
  });

  it("throws if trying to create an unregistered entity", () => {
    const model = { id: '123' };

    expect(() => EntityRegistry.create("unknown", model)).toThrow(EntityNotRegistered);
  });
});
