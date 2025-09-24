import { describe, it, expect } from "@jest/globals";
import { expectTypeOf } from "expect-type";

import { ValueObject, CoordinatesValue } from "../../src/value-objects";

class TestCoordinatesValue extends CoordinatesValue {
  readonly attributeName = "test";
}

describe("CoordinatesValue", () => {
  it('should implement "ValueObject" interface', () => {
    expectTypeOf<CoordinatesValue>().toExtend<ValueObject>();
  });

  it('should have a "valueType" with "Coordinates" as value', () => {
    const testCoordinatesValue = new TestCoordinatesValue({ latitude: 0, longitude: 0 });

    expect(testCoordinatesValue.valueType).toEqual("Coordinates");
  });

  it('should have a "value" property of type { latitude: number, longitude: number }', () => {
    expectTypeOf<CoordinatesValue["value"]>().toMatchObjectType<{ latitude: number, longitude: number }>();
  });

  it('should have a "latitude" property of type number or null', () => {
    expectTypeOf<CoordinatesValue["latitude"]>().toEqualTypeOf<number | null>();
  });

  it('should have a "longitude" property of type number or null', () => {
    expectTypeOf<CoordinatesValue["longitude"]>().toEqualTypeOf<number | null>();
  });

  describe('when "value" is a valid coordinate', () => {
    const coordinates = { latitude: 0, longitude: 0 };
    const testCoordinatesValue = new TestCoordinatesValue(coordinates);

    it('should return true the "isValid" getter', () => {
      expect(testCoordinatesValue.isValid).toBeTruthy();
    });

    it('should return the latitude value', () => {
      expect(testCoordinatesValue.latitude).toEqual(coordinates.latitude);
    });

    it('should return the longitude value', () => {
      expect(testCoordinatesValue.longitude).toEqual(coordinates.longitude);
    });
  });

  describe('when "value" is not a valid coordinate', () => {
    const testCoordinatesValue = new TestCoordinatesValue({ latitude: -200, longitude: 500 });

    it('should return false the "isValid" getter', () => {
      expect(testCoordinatesValue.isValid).toBeFalsy();
    });

    it('should return null as the latitude value', () => {
      expect(testCoordinatesValue.latitude).toBeNull();
    });

    it('should return null as the longitude value', () => {
      expect(testCoordinatesValue.longitude).toBeNull();
    });
  });
});
