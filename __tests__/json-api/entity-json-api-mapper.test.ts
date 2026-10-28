import {
  Entity,
  EntityJSONAPIMapper,
  UUIDValue,
} from "../../src";
import {
  TestUUIDValue,
} from "../support/fixtures";

describe("EntityJSONAPIMapper", () => {
  it("maps entities both ways without mutating toPrimitives output", () => {
    const internalModel = {
      id: "123e4567-e89b-12d3-a456-426614174099",
      total: 320,
      items: ["book", "pen"],
    };

    class MappedOrderEntity extends Entity<UUIDValue, typeof internalModel> {
      constructor(
        id: UUIDValue,
        public total: number,
        public items: string[],
      ) {
        super(id);
      }

      protected override createId(rawId: string): UUIDValue {
        return TestUUIDValue.fromPrimitives(rawId);
      }

      toPrimitives() {
        return internalModel;
      }

      override restoreFromPrimitives(data: typeof internalModel): void {
        this.total = data.total;
        this.items = [...data.items];
      }
    }

    const mapper = new EntityJSONAPIMapper<typeof internalModel, MappedOrderEntity>(
      "orders",
      MappedOrderEntity,
    );
    const entity = new MappedOrderEntity(
      new TestUUIDValue(internalModel.id),
      internalModel.total,
      internalModel.items,
    );

    const jsonApiDoc = mapper.mapEntity(entity);
    expect(internalModel.id).toBe("123e4567-e89b-12d3-a456-426614174099");
    expect(jsonApiDoc).toEqual({
      data: {
        type: "orders",
        id: "123e4567-e89b-12d3-a456-426614174099",
        attributes: {
          total: 320,
          items: ["book", "pen"],
        },
      },
    });

    const roundTripEntity = mapper.toEntity(jsonApiDoc);
    expect(roundTripEntity).toBeInstanceOf(MappedOrderEntity);
    expect(roundTripEntity.id.value).toBe("123e4567-e89b-12d3-a456-426614174099");
    expect(roundTripEntity.total).toBe(320);
    expect(roundTripEntity.items).toEqual(["book", "pen"]);
  });
});
