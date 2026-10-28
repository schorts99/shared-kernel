import { Operator } from "./operator.js";

/** A value that range operators can order: numbers, strings, booleans, bigints, or dates (Date or ISO string). */
export type ComparableFilterValue = string | number | bigint | boolean | Date;

export type GeoPoint =
  | readonly [latitude: number, longitude: number]
  | { lat: number; lng: number }
  | { lat: number; lon: number }
  | { latitude: number; longitude: number };

export type GeoRadiusDistance =
  | { radiusInM: number }
  | { radius: number }
  | { radiusMeters: number }
  | { radiusInKm: number };

export type GeoRadiusFilterValue = (
  | { center: GeoPoint }
  | { lat: number; lng: number }
  | { lat: number; lon: number }
  | { latitude: number; longitude: number }
) & GeoRadiusDistance;

export type BetweenFilterValue =
  | readonly [min: ComparableFilterValue, max: ComparableFilterValue]
  | { min: ComparableFilterValue; max: ComparableFilterValue }
  | { from: ComparableFilterValue; to: ComparableFilterValue };

/** The value each operator expects. */
export interface FilterValueByOperator {
  EQUAL: unknown;
  NOT_EQUAL: unknown;
  GREATER_THAN: ComparableFilterValue;
  LESS_THAN: ComparableFilterValue;
  GREATER_THAN_OR_EQUAL: ComparableFilterValue;
  LESS_THAN_OR_EQUAL: ComparableFilterValue;
  IN: ReadonlyArray<unknown>;
  NOT_IN: ReadonlyArray<unknown>;
  /** SQL-style pattern: `%` matches any run of characters, `_` matches one. */
  LIKE: string;
  BETWEEN: BetweenFilterValue;
  GEO_RADIUS: GeoRadiusFilterValue;
  ARRAY_CONTAINS: unknown;
  ARRAY_CONTAINS_ANY: ReadonlyArray<unknown>;
}

export type FilterValue<O extends Operator = Operator> = FilterValueByOperator[O];

/** A single filter. Narrow on `operator` to get the matching `value` type. */
export type Filter = {
  [O in Operator]: { field: string; operator: O; value: FilterValue<O> };
}[Operator];

export type Filters = Array<Filter>;
