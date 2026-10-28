import { URLWithParamsBuilder } from "../utils/index.js";
import { Criteria } from "../criteria/index.js";

export class URLCriteriaBuilder {
  constructor(
    private readonly base: URL,
    private readonly criteria?: Criteria,
    private readonly include?: string[]
  ) {}

  build(): URL {
    const builder = new URLWithParamsBuilder(new URL(this.base.href));

    if (this.include?.length) {
      builder.with({ include: this.include.join(",") });
    }

    if (this.criteria) {
      const formatScalar = (val: unknown): string | number | boolean => {
        if (val instanceof Date) return val.toISOString();
        if (typeof val === "number" || typeof val === "boolean") return val;
        return String(val);
      };

      this.criteria.filters.forEach(({ field, operator, value }) => {
        const encodedField = field.replace(/\./g, ".");

        switch (operator) {
          case "EQUAL":
            builder.with({ [`filter[${encodedField}]`]: formatScalar(value) });

            break;
          case "NOT_EQUAL":
            builder.with({ [`filter[${encodedField}][ne]`]: formatScalar(value) });

            break;

          case "GREATER_THAN":
            builder.with({ [`filter[${encodedField}][gt]`]: formatScalar(value) });

            break;
          case "LESS_THAN":
            builder.with({ [`filter[${encodedField}][lt]`]: formatScalar(value) });

            break;
          case "GREATER_THAN_OR_EQUAL":
            builder.with({ [`filter[${encodedField}][gte]`]: formatScalar(value) });

            break;
          case "LESS_THAN_OR_EQUAL":
            builder.with({ [`filter[${encodedField}][lte]`]: formatScalar(value) });

            break;
          case "IN":
            if (Array.isArray(value)) {
              builder.with({
                [`filter[${encodedField}][in]`]: value.map(v => String(formatScalar(v))).join(","),
              });
            }

            break;
          case "ARRAY_CONTAINS":
            builder.with({ [`filter[${encodedField}][array_contains]`]: formatScalar(value) });

            break;
          case "ARRAY_CONTAINS_ANY":
            if (Array.isArray(value)) {
              builder.with({
                [`filter[${encodedField}][array_contains_any]`]: value
                  .map(v => String(formatScalar(v)))
                  .join(","),
              });
            }
            break;

          case "NOT_IN":
            if (Array.isArray(value)) {
              builder.with({
                [`filter[${encodedField}][nin]`]: value.map(v => String(formatScalar(v))).join(","),
              });
            }

            break;
          case "LIKE":
            builder.with({ [`filter[${encodedField}][like]`]: formatScalar(value) });

            break;
          case "BETWEEN":
            if (Array.isArray(value) && value.length === 2) {
              builder.with({
                [`filter[${encodedField}][between]`]: `${formatScalar(value[0])},${formatScalar(value[1])}`,
              });
            }

            break;
          case "GEO_RADIUS":
            if (value && typeof value === "object") {
              const lat =
                value.lat ??
                value.latitude ??
                (Array.isArray(value.center) ? value.center[0] : undefined);
              const lng =
                value.lng ??
                value.longitude ??
                (Array.isArray(value.center) ? value.center[1] : undefined);
              const radius = value.radius ?? value.radiusInM ?? value.radiusMeters;

              builder.with({
                [`filter[${encodedField}][geo_radius]`]: `${lat},${lng},${radius}`,
              });
            }

            break;
          default:
            throw new Error(`Unsupported operator: ${operator satisfies never}`);
        }
      });

      if (this.criteria.orders.length > 0) {
        const sortParam = this.criteria.orders
          .map(({ field, direction }) => (direction === "DESC" ? `-${field}` : field))
          .join(",");
	
        builder.with({ sort: sortParam });
      }

      if (this.criteria.limit !== undefined) {
        builder.with({ "page[limit]": this.criteria.limit });
      }

      if (this.criteria.offset !== undefined) {
        builder.with({ "page[offset]": this.criteria.offset });
      }
    }

    return builder.build();
  }
}
