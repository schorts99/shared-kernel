import { EntityRegistry, Entity, EntityNotRegistered } from "../../src/entities";
import { UUIDValue } from "../../src/value-objects";

type MockModel = {
  id: string;
};

class IDValue extends UUIDValue {
  attributeName = 'ID';
}

class MockEntity extends Entity<IDValue, MockModel> {
  constructor(id: IDValue) {
    super(id);
  }

  toPrimitives(): MockModel {
    return {
      id: this.id.value,
    };
  }

  static fromPrimitives<MockModel>(model: MockModel): MockEntity {
    return new MockEntity(
      new IDValue(model["id"]),
    );
  }
}

describe("EntityRegistry", () => {
  const type = "mock";

  beforeEach(() => {
    (EntityRegistry as any).registry.clear();
  });

  it("registers an entity constructor", () => {
    EntityRegistry.register(type, MockEntity);

    const resolved = EntityRegistry.resolve(type);

    expect(resolved).toBe(MockEntity);
  });

  it("resolves a registered entity constructor", () => {
    EntityRegistry.register(type, MockEntity);

    const resolved = EntityRegistry.resolve(type);

    expect(resolved?.fromPrimitives).toBeDefined();
  });

  it("returns null for unregistered types", () => {
    const resolved = EntityRegistry.resolve("unknown");

    expect(resolved).toBeNull();
  });

  it("creates an entity from a registered constructor", () => {
    EntityRegistry.register(type, MockEntity);

    const entity = EntityRegistry.create(type, { id: '123', name: 'Jorge' });

    expect(entity).toBeInstanceOf(MockEntity);
    expect(entity.id.value).toEqual('123');
  });

  it("throws EntityNotRegistered for unknown type", () => {
    expect(() => EntityRegistry.create("unknown", { id: '123' })).toThrow(EntityNotRegistered);
  });
});
